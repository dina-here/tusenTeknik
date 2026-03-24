import "reflect-metadata";
import { json, urlencoded } from "express";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { execSync } from "child_process";

async function runMigrations() {
  try {
    console.log("Running Prisma migrations...");
    const prismaCwd = process.env.PRISMA_WORKSPACE_DIR || "/opt/render/project/src/prisma";
    console.log(`[DEBUG] Running migrations from: ${prismaCwd}`);
    console.log(`[DEBUG] DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
    execSync("pnpm prisma migrate deploy", {
      stdio: "inherit",
      cwd: prismaCwd,
      env: { ...process.env, NODE_ENV: "production" }
    });
    console.log("✓ Migrations completed");
  } catch (err: any) {
    console.error("⚠ Migration failed:", err.message);
    console.error("Continuing anyway - migrations may have already been applied");
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["log", "error", "warn"]
  });

  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ extended: true, limit: "10mb" }));
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  });

  const port = process.env.NODE_ENV === "production" ? 3000 : (Number(process.env.PORT) || 10000);
  await app.listen(port, "0.0.0.0");
  console.log(`API igång på http://0.0.0.0:${port}`);

  // Run migrations after server is already listening so Render sees the port immediately.
  // Seed is handled in buildCommand (render.yaml) and does not need to run on every startup.
  runMigrations();
}

bootstrap();
