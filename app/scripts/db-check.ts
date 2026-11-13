import "dotenv/config";
import mariadb from "mariadb";

async function main() {
  console.log("DATABASE_PASSWORD is set:", Boolean(process.env.DATABASE_PASSWORD));

  for (const host of ["127.0.0.1", "localhost", "::1"]) {
    try {
      const conn = await mariadb.createConnection({
        host,
        port: 3306,
        user: "root",
        password: process.env.DATABASE_PASSWORD,
        database: "portfolio",
        connectTimeout: 4000,
      });
      const rows = await conn.query("SELECT 1 AS ok");
      console.log(host, "-> OK", rows);
      await conn.end();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      console.log(host, "-> FAILED:", err.code, err.message);
    }
  }
}

main();