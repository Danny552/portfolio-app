import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const adapter = new PrismaMariaDb({
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: process.env.DATABASE_PASSWORD,
  database: "portfolio",
  connectionLimit: 5,
  allowPublicKeyRetrieval: true, // local dev only, see note below
});

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
