import { PrismaClient } from "@prisma/client";

// Singleton pattern for PrismaClient in serverless environments (Vercel)
// This prevents connection pool exhaustion
declare global {
  // eslint-disable-next-line no-var
  var __db: PrismaClient | undefined;
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__db) {
    global.__db = new PrismaClient();
  }
  prisma = global.__db;
}

export default prisma;
