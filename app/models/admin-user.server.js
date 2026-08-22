import prisma from "../db.server";
import { hashPassword } from "../utils/password.server";

export function normalizeAdminEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function listAdminUsers() {
  return prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getAdminUserById(id) {
  if (!id) return null;
  return prisma.adminUser.findUnique({
    where: { id },
  });
}

export async function getAdminUserByEmail(email) {
  const normalized = normalizeAdminEmail(email);
  if (!normalized) return null;
  return prisma.adminUser.findUnique({
    where: { email: normalized },
  });
}

export async function createAdminUser({ email, name, password, role = "admin" }) {
  return prisma.adminUser.create({
    data: {
      email: normalizeAdminEmail(email),
      name: String(name || "").trim() || "Admin",
      passwordHash: await hashPassword(password),
      role: role === "owner" ? "owner" : "admin",
    },
  });
}

export async function deleteAdminUser(id) {
  return prisma.adminUser.delete({
    where: { id },
  });
}

export async function countAdminUsers() {
  return prisma.adminUser.count();
}

export async function ensureBootstrapAdmin() {
  const email = normalizeAdminEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    return null;
  }

  const existing = await getAdminUserByEmail(email);
  if (existing) {
    return existing;
  }

  return createAdminUser({
    email,
    name: process.env.ADMIN_NAME || "Admin",
    password,
    role: "owner",
  });
}
