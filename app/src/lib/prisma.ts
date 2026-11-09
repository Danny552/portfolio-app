import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const adapter = new PrismaMariaDb({
  host: "localhost",
  port: 3306,
  user: "root",
  password: process.env.DATABASE_PASSWORD,
  database: "portfolio",
  connectionLimit: 5,
});

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
