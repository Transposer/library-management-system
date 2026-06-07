const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { formatDateTime } = require("../utils/date");
const auditLogService = require("./auditLogService");

const ALLOWED_TYPES = ["CLOSURE", "ACTIVITY", "RULE_CHANGE", "TIME_CHANGE", "OTHER"];
const TITLE_MIN = 1;
const TITLE_MAX = 200;
const CONTENT_MIN = 1;
const CONTENT_MAX = 10000;

function parsePagination(query) {
  const page = Number(query.page || 1);
  const size = Number(query.size || 10);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) {
    throw new AppError(400, "参数错误");
  }

  return { page, size };
}

function toAnnouncementDTO(announcement) {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    type: announcement.type,
    status: announcement.publishedAt ? "published" : "draft",
    publishedAt: announcement.publishedAt ? formatDateTime(announcement.publishedAt) : null,
    createdAt: formatDateTime(announcement.createdAt),
  };
}

function validateAnnouncementPayload(payload, { partial = false } = {}) {
  const data = {};

  if (!partial || payload.title !== undefined) {
    const title = typeof payload.title === "string" ? payload.title.trim() : "";

    if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
      throw new AppError(400, "公告标题长度需在 1-200 字符之间");
    }

    data.title = title;
  }

  if (!partial || payload.content !== undefined) {
    const content = typeof payload.content === "string" ? payload.content.trim() : "";

    if (content.length < CONTENT_MIN || content.length > CONTENT_MAX) {
      throw new AppError(400, "公告正文长度需在 1-10000 字符之间");
    }

    data.content = content;
  }

  if (!partial || payload.type !== undefined) {
    const type = payload.type || "OTHER";

    if (!ALLOWED_TYPES.includes(type)) {
      throw new AppError(400, "公告类型无效");
    }

    data.type = type;
  }

  return data;
}

async function getAnnouncementOrThrow(id) {
  const announcement = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!announcement) {
    throw new AppError(404, "公告不存在");
  }

  return announcement;
}

function buildListWhere(query) {
  const where = {};
  const type = typeof query?.type === "string" ? query.type.trim() : "";

  if (type) {
    if (!ALLOWED_TYPES.includes(type)) {
      throw new AppError(400, "公告类型无效");
    }
    where.type = type;
  }

  const status = typeof query?.status === "string" ? query.status.trim() : "all";

  if (status === "published") {
    where.publishedAt = { not: null };
  } else if (status === "draft") {
    where.publishedAt = null;
  } else if (status !== "all") {
    throw new AppError(400, "状态参数无效");
  }

  const keyword = typeof query?.keyword === "string" ? query.keyword.trim() : "";

  if (keyword) {
    where.title = { contains: keyword };
  }

  return where;
}

async function createAnnouncement(operatorId, payload) {
  const data = validateAnnouncementPayload(payload);

  const announcement = await prisma.announcement.create({
    data: {
      ...data,
      publishedAt: null,
    },
  });

  await auditLogService.record(operatorId, "ADMIN_CREATE_ANNOUNCEMENT", "Announcement", announcement.id, {
    title: announcement.title,
    type: announcement.type,
    status: "draft",
  });

  return toAnnouncementDTO(announcement);
}

async function updateAnnouncement(operatorId, id, payload) {
  const existing = await getAnnouncementOrThrow(id);
  const data = validateAnnouncementPayload(payload, { partial: true });

  if (Object.keys(data).length === 0) {
    throw new AppError(400, "没有可更新的字段");
  }

  const announcement = await prisma.announcement.update({
    where: { id },
    data,
  });

  const changes = {};

  for (const key of Object.keys(data)) {
    if (existing[key] !== announcement[key]) {
      changes[key] = {
        oldValue: existing[key],
        newValue: announcement[key],
      };
    }
  }

  await auditLogService.record(operatorId, "ADMIN_UPDATE_ANNOUNCEMENT", "Announcement", announcement.id, changes);

  return toAnnouncementDTO(announcement);
}

async function deleteAnnouncement(operatorId, id) {
  const announcement = await getAnnouncementOrThrow(id);

  await prisma.$transaction(async (tx) => {
    await tx.announcement.delete({
      where: { id },
    });

    await auditLogService.recordWithClient(
      tx,
      operatorId,
      "ADMIN_DELETE_ANNOUNCEMENT",
      "Announcement",
      id,
      {
        title: announcement.title,
        type: announcement.type,
        status: announcement.publishedAt ? "published" : "draft",
      },
    );
  });
}

async function publishAnnouncement(operatorId, id) {
  const existing = await getAnnouncementOrThrow(id);

  if (existing.publishedAt) {
    throw new AppError(400, "公告已发布");
  }

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      publishedAt: new Date(),
    },
  });

  await auditLogService.record(operatorId, "ADMIN_PUBLISH_ANNOUNCEMENT", "Announcement", announcement.id, {
    title: announcement.title,
    oldStatus: "draft",
    newStatus: "published",
  });

  return toAnnouncementDTO(announcement);
}

async function unpublishAnnouncement(operatorId, id) {
  const existing = await getAnnouncementOrThrow(id);

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      publishedAt: null,
    },
  });

  await auditLogService.record(operatorId, "ADMIN_UNPUBLISH_ANNOUNCEMENT", "Announcement", announcement.id, {
    title: announcement.title,
    oldStatus: existing.publishedAt ? "published" : "draft",
    newStatus: "draft",
  });

  return toAnnouncementDTO(announcement);
}

async function listAnnouncements(query) {
  const { page, size } = parsePagination(query || {});
  const where = buildListWhere(query);

  const [total, announcements] = await prisma.$transaction([
    prisma.announcement.count({ where }),
    prisma.announcement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * size,
      take: size,
    }),
  ]);

  return {
    total,
    page,
    size,
    list: announcements.map(toAnnouncementDTO),
  };
}

module.exports = {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  unpublishAnnouncement,
  listAnnouncements,
};
