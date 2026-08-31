import dotenv from "dotenv";
dotenv.config({ override: true });

import { PrismaClient } from "@prisma/client";

function resolveDatabaseUrl() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) return url;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const isPooler =
    parsed.hostname.includes("-pooler.") ||
    parsed.searchParams.get("pgbouncer") === "true";

  parsed.searchParams.delete("channel_binding");

  if (!isPooler) {
    return parsed.toString();
  }

  if (!parsed.searchParams.has("pgbouncer")) {
    parsed.searchParams.set("pgbouncer", "true");
  }

  const currentLimit = Number(parsed.searchParams.get("connection_limit"));
  if (!Number.isFinite(currentLimit) || currentLimit < 5) {
    parsed.searchParams.set("connection_limit", "5");
  }
  if (!parsed.searchParams.has("pool_timeout")) {
    parsed.searchParams.set("pool_timeout", "20");
  }
  if (!parsed.searchParams.has("connect_timeout")) {
    parsed.searchParams.set("connect_timeout", "15");
  }

  return parsed.toString();
}

function createPrismaClient() {
  const url = resolveDatabaseUrl();
  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
}

const databaseUrl = resolveDatabaseUrl();
if (!global.prismaGlobal || global.prismaDatabaseUrl !== databaseUrl) {
  if (global.prismaGlobal) {
    void global.prismaGlobal.$disconnect().catch(() => {});
  }
  global.prismaGlobal = createPrismaClient();
  global.prismaDatabaseUrl = databaseUrl;
}

const prisma = global.prismaGlobal;

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

export async function withPrismaRetry(work, { attempts = 3 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (error?.code !== "P2024" || attempt === attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    }
  }

  throw lastError;
}

export default prisma;
