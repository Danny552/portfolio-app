import { readFileSync } from "fs";
import path from "path";
import { faker } from "@faker-js/faker/locale/es";
import { prisma } from "../src/lib/prisma";

async function main() {
  // --- Clear old data so the seed can be re-run ---
  await prisma.auditLog.deleteMany();
  await prisma.creditAccount.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.income.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.expense.deleteMany();
  // Client -> ImportBatch -> User -> Client is circular, so break it first
  await prisma.client.updateMany({ data: { importBatchId: null } });
  await prisma.importBatch.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.economicActivity.deleteMany();

  // --- Economic activities (CIIU Rev. 4 A.C., from the DANE PDF) ---
  const ciiu = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "prisma", "data", "ciiu-rev4-ac.json"),
      "utf-8"
    )
  );
  await prisma.economicActivity.createMany({ data: ciiu });
  const activities = await prisma.economicActivity.findMany();
  console.log(`Loaded ${activities.length} economic activities`);

  // --- Portfolios ---
  const portfolios = await Promise.all([
    prisma.portfolio.create({
      data: { name: "Cartera propia", origin: "ORIGINAL" },
    }),
    prisma.portfolio.create({
      data: {
        name: "Cartera adquirida 2026",
        origin: "PURCHASED",
        source: "Asesor externo (demo)",
        acquiredAt: new Date("2026-03-01"),
      },
    }),
  ]);

  // --- Admin user ---
  await prisma.user.create({
    data: { email: "admin@demo.local", name: "Admin Demo", role: "ADMIN" },
  });

  // --- 20 fake clients with their related rows ---
  for (let i = 0; i < 20; i++) {
    const selfEmployed = faker.datatype.boolean();
    const client = await prisma.client.create({
      data: {
        portfolioId: faker.helpers.arrayElement(portfolios).id,
        fullName: faker.person.fullName(),
        documentType: "CC",
        documentNumber: faker.string.numeric(10),
        birthDate: faker.date.birthdate({ min: 25, max: 70, mode: "age" }),
        profession: faker.person.jobType(),
        occupationType: selfEmployed ? "SELF_EMPLOYED" : "EMPLOYEE",
        jobTitle: selfEmployed ? null : faker.person.jobTitle(),
        economicActivityId: selfEmployed
          ? faker.helpers.arrayElement(activities).id
          : null,
        yearsExperience: faker.number.int({ min: 1, max: 35 }),
        maritalStatus: faker.helpers.arrayElement([
          "SINGLE",
          "MARRIED",
          "COMMON_LAW",
          "DIVORCED",
          "WIDOWED",
        ]),
        dependents: faker.number.int({ min: 0, max: 4 }),
        email: faker.internet.email().toLowerCase(),
        phone: "+57 3" + faker.string.numeric(9),
        incomes: {
          create: [
            {
              type: "FIXED",
              description: "Salario / honorarios",
              monthlyAmount: faker.number.int({ min: 2_000_000, max: 25_000_000 }),
            },
            {
              type: "ADDITIONAL",
              description: "Arriendos",
              monthlyAmount: faker.number.int({ min: 0, max: 3_000_000 }),
            },
          ],
        },
        assets: {
          create: [
            {
              category: "Inmueble",
              description: "Apartamento",
              value: faker.number.int({ min: 150_000_000, max: 900_000_000 }),
            },
            {
              category: "Vehículo",
              description: "Automóvil",
              value: faker.number.int({ min: 20_000_000, max: 120_000_000 }),
            },
          ],
        },
        expenses: {
          create: [
            {
              category: "Vivienda",
              monthlyAmount: faker.number.int({ min: 500_000, max: 3_000_000 }),
            },
            {
              category: "Alimentación",
              monthlyAmount: faker.number.int({ min: 400_000, max: 2_000_000 }),
            },
          ],
        },
        creditAccounts: {
          create: [
            {
              entity: faker.helpers.arrayElement(["Banco Demo A", "Banco Demo B"]),
              accountType: "Tarjeta de crédito",
              creditLimit: 8_000_000,
              balance: faker.number.int({ min: 0, max: 6_000_000 }),
              status: "Al día",
              reportDate: new Date(),
            },
          ],
        },
      },
    });
    console.log("Created", client.fullName);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());