import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  javanehPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.javanehPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production")
  globalForPrisma.javanehPrisma = prisma;