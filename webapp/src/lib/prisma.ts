import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,                    // Lower max — serverless functions should be lightweight
    idleTimeoutMillis: 10000,  // Release idle connections after 10s
    connectionTimeoutMillis: 10000, // Fail fast if pool is exhausted (10s)
  });
  pool.on("error", () => {}); // Prevent unhandled error crashes on idle connections
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
