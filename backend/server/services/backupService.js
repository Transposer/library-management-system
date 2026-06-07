const fs = require("fs");
const path = require("path");
const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { formatDateTime } = require("../utils/date");
const auditLogService = require("./auditLogService");

const BACKEND_ROOT = path.resolve(__dirname, "../..");

function parsePagination(query) {
  const page = Number(query.page || 1);
  const size = Number(query.size || 10);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) {
    throw new AppError(400, "参数错误");
  }

  return { page, size };
}

function resolveDatabasePath() {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  let filePath = dbUrl.replace(/^file:/, "");

  if (!path.isAbsolute(filePath)) {
    filePath = path.resolve(BACKEND_ROOT, filePath);
  }

  return filePath;
}

function resolveBackupDir() {
  const configured = process.env.BACKUP_DIR;

  if (configured && configured.trim()) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(BACKEND_ROOT, configured);
  }

  return path.resolve(BACKEND_ROOT, "backups");
}

function buildBackupFileName(date = new Date()) {
  const pad = (num) => String(num).padStart(2, "0");
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");

  return `backup-${stamp}.db`;
}

function toBackupDTO(record) {
  return {
    id: record.id,
    fileName: record.fileName,
    fileSize: record.fileSize,
    operatorId: record.operatorId,
    createdAt: formatDateTime(record.createdAt),
  };
}

async function createBackup(operatorId) {
  const sourcePath = resolveDatabasePath();

  if (!fs.existsSync(sourcePath)) {
    throw new AppError(500, "数据库文件不存在，无法备份");
  }

  const backupDir = resolveBackupDir();

  try {
    fs.mkdirSync(backupDir, { recursive: true });
  } catch (error) {
    throw new AppError(500, "备份目录不可写");
  }

  const fileName = buildBackupFileName();
  const targetPath = path.resolve(backupDir, fileName);

  try {
    await fs.promises.copyFile(sourcePath, targetPath);
  } catch (error) {
    throw new AppError(500, "数据库备份失败");
  }

  const stats = await fs.promises.stat(targetPath);

  const record = await prisma.backupRecord.create({
    data: {
      fileName,
      filePath: targetPath,
      fileSize: stats.size,
      operatorId: operatorId || null,
    },
  });

  await auditLogService.record(operatorId, "ADMIN_CREATE_BACKUP", "Backup", record.id, {
    fileName: record.fileName,
    fileSize: record.fileSize,
    filePath: record.filePath,
  });

  return toBackupDTO(record);
}

async function listBackups(query) {
  const { page, size } = parsePagination(query || {});

  const [total, records] = await prisma.$transaction([
    prisma.backupRecord.count(),
    prisma.backupRecord.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * size,
      take: size,
    }),
  ]);

  return {
    total,
    page,
    size,
    list: records.map(toBackupDTO),
  };
}

async function getBackupFilePath(id) {
  const record = await prisma.backupRecord.findUnique({
    where: { id },
  });

  if (!record) {
    throw new AppError(404, "备份记录不存在");
  }

  if (!fs.existsSync(record.filePath)) {
    throw new AppError(404, "备份文件已丢失");
  }

  return {
    filePath: record.filePath,
    fileName: record.fileName,
  };
}

async function deleteBackup(operatorId, id) {
  const record = await prisma.backupRecord.findUnique({
    where: { id },
  });

  if (!record) {
    throw new AppError(404, "备份记录不存在");
  }

  await prisma.$transaction(async (tx) => {
    await tx.backupRecord.delete({
      where: { id },
    });

    await auditLogService.recordWithClient(tx, operatorId, "ADMIN_DELETE_BACKUP", "Backup", id, {
      fileName: record.fileName,
      filePath: record.filePath,
      fileSize: record.fileSize,
    });
  });

  if (fs.existsSync(record.filePath)) {
    try {
      await fs.promises.unlink(record.filePath);
    } catch (error) {
      // 记录已删除，物理文件删除失败不阻断响应
    }
  }
}

module.exports = {
  createBackup,
  listBackups,
  getBackupFilePath,
  deleteBackup,
};
