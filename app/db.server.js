import dotenv from "dotenv";
dotenv.config({ override: true });

import { PrismaClient } from "@prisma/client";

function resolveDatabaseUrl() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) return url;

  const isPooler = url.includes("-pooler.") || url.includes("pgbouncer=true");
  if (!isPooler) return url;

  const params = [];
  if (!url.includes("pgbouncer=")) params.push("pgbouncer=true");
  if (!url.includes("connection_limit=")) params.push("connection_limit=1");
  if (!url.includes("connect_timeout=")) params.push("connect_timeout=15");
  if (params.length === 0) return url;

  return `${url}${url.includes("?") ? "&" : "?"}${params.join("&")}`;
}

function createPrismaClient() {
  const url = resolveDatabaseUrl();
  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
}

if (process.env.NODE_ENV !== "production" && global.prismaGlobal) {
  void global.prismaGlobal.$disconnect();
  global.prismaGlobal = undefined;
}

const prisma = global.prismaGlobal ?? createPrismaClient();
global.prismaGlobal = prisma;

export async function ensurePrismaConnected() {
  let lastError;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      lastError = error;
      console.error(`Database connection attempt ${attempt} failed:`, error?.message || error);
      await prisma.$disconnect().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  throw lastError;
}

export default prisma;
