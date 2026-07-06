import { PrismaClient } from "@prisma/client";

function createPrismaClient() {
  return new PrismaClient();
}

// Recreate the client in development when this module reloads so schema
// changes from `prisma generate` are picked up without a full process restart.
let prisma;
if (process.env.NODE_ENV === "production") {
  prisma = global.prismaGlobal ?? createPrismaClient();
  global.prismaGlobal = prisma;
} else {
  if (global.prismaGlobal) {
    void global.prismaGlobal.$disconnect();
  }
  prisma = createPrismaClient();
  global.prismaGlobal = prisma;
}

export default prisma;
