const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { formatDateTime } = require("../utils/date");
const auditLogService = require("./auditLogService");

const VALID_STATUSES = ["PENDING", "ACCEPTED", "REJECTED"];

function parsePagination(query) {
  const page = Number(query.page || 1);
  const size = Number(query.size || 10);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) {
    throw new AppError(400, "Invalid pagination parameters");
  }

  return { page, size };
}

function toRequestDTO(request) {
  return {
    id: request.id,
    title: request.title,
    author: request.author,
    isbn: request.isbn || "",
    reason: request.reason || "",
    status: request.status,
    createdAt: formatDateTime(request.createdAt),
    user: request.user
      ? { id: request.user.id, name: request.user.name, email: request.user.email }
      : null,
  };
}

async function listAllRequests(query) {
  const { page, size } = parsePagination(query || {});
  const where = {};

  const status = typeof query?.status === "string" ? query.status.trim().toUpperCase() : "";
  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      throw new AppError(400, "Invalid status. Must be PENDING, ACCEPTED, or REJECTED");
    }
    where.status = status;
  }

  const keyword = typeof query?.keyword === "string" ? query.keyword.trim() : "";
  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { author: { contains: keyword } },
      { isbn: { contains: keyword } },
    ];
  }

  const [total, requests] = await Promise.all([
    prisma.acquisitionRequest.count({ where }),
    prisma.acquisitionRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * size,
      take: size,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    size,
    list: requests.map(toRequestDTO),
  };
}

async function approveRequest(operatorId, id) {
  const request = await prisma.acquisitionRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!request) {
    throw new AppError(404, "Acquisition request not found");
  }

  if (request.status !== "PENDING") {
    throw new AppError(400, "Only pending requests can be approved");
  }

  const updated = await prisma.acquisitionRequest.update({
    where: { id },
    data: { status: "ACCEPTED" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  await auditLogService.record(operatorId, "ADMIN_APPROVE_ACQUISITION", "Acquisition", id, {
    title: request.title,
    author: request.author,
    oldStatus: "PENDING",
    newStatus: "ACCEPTED",
  });

  return toRequestDTO(updated);
}

async function rejectRequest(operatorId, id, reason) {
  const request = await prisma.acquisitionRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!request) {
    throw new AppError(404, "Acquisition request not found");
  }

  if (request.status !== "PENDING") {
    throw new AppError(400, "Only pending requests can be rejected");
  }

  const updated = await prisma.acquisitionRequest.update({
    where: { id },
    data: { status: "REJECTED" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  await auditLogService.record(operatorId, "ADMIN_REJECT_ACQUISITION", "Acquisition", id, {
    title: request.title,
    author: request.author,
    reason: reason || "",
    oldStatus: "PENDING",
    newStatus: "REJECTED",
  });

  return toRequestDTO(updated);
}

module.exports = {
  listAllRequests,
  approveRequest,
  rejectRequest,
};
