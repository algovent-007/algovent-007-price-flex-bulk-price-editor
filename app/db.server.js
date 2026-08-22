import dotenv from "dotenv";
dotenv.config({ override: true });

import { PrismaClient } from "@prisma/client";

function isTransientDbError(error) {
  const message = String(error?.message || error || "");
  const name = String(error?.name || "");
  return (
    name === "PrismaClientInitializationError" ||
    message.includes("Server has closed the connection") ||
    message.includes("Can't reach database server") ||
    message.includes("Connection terminated") ||
    message.includes("Connection reset") ||
    message.includes("Timed out fetching a new connection")
  );
}

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

let prismaClient = global.prismaGlobal ?? createPrismaClient();
global.prismaGlobal = prismaClient;

async function recreatePrismaClient() {
  await prismaClient.$disconnect().catch(() => {});
  prismaClient = createPrismaClient();
  global.prismaGlobal = prismaClient;
  return prismaClient;
}

function withRetry(run) {
  return Promise.resolve()
    .then(run)
    .catch(async (error) => {
      if (!isTransientDbError(error)) {
        throw error;
      }
      await recreatePrismaClient();
      return run();
    });
}

export async function ensurePrismaConnected() {
  let lastError;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await prismaClient.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      lastError = error;
      console.error(`Database connection attempt ${attempt} failed:`, error?.message || error);
      await recreatePrismaClient();
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  throw lastError;
}

const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      const value = prismaClient[prop];

      if (typeof value === "function") {
        return (...args) => withRetry(() => prismaClient[prop](...args));
      }

      if (value && typeof value === "object") {
        return new Proxy(value, {
          get(_model, method) {
            const fn = prismaClient[prop][method];
            if (typeof fn !== "function") {
              return fn;
            }
            return (...args) => withRetry(() => prismaClient[prop][method](...args));
          },
        });
      }

      return value;
    },
  },
);

export default prisma;
