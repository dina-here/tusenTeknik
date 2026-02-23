import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { execSync } from "child_process";
import path from "path";

async function bootstrap() {
  // Auto-run migrations on startup (needed for Render Free plan)
  try {
    console.log("Running Prisma migrations...");
    const prismaCwd = process.env.PRISMA_WORKSPACE_DIR || path.resolve(__dirname, "..", "..", "..", "prisma");
    console.log(`[DEBUG] Running migrations from: ${prismaCwd}`);
    console.log(`[DEBUG] DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
    execSync("pnpm prisma migrate deploy", {
      stdio: "inherit",
      cwd: prismaCwd,
      env: {
        ...process.env,
        NODE_ENV: "production"
      }
    });
    console.log("✓ Migrations completed");
  } catch (err: any) {
    console.error("⚠ Migration failed:", err.message);
    console.error("Continuing anyway - migrations may have already been applied");
  }

  const app = await NestFactory.create(AppModule, {
    // Nest logger räcker för demo; kan bytas till pino senare.
    logger: ["log", "error", "warn"]
  });

  // Central felhantering (konsekvent JSON vid fel)
  app.useGlobalFilters(new AllExceptionsFilter());

  // ✅ DEMO: tillåt anrop från Vite-frontends
  const defaultOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://milleteknik-admin-ui.onrender.com",
    "https://milleteknik-powerwatch-ui.onrender.com"
  ];
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : defaultOrigins;

  app.enableCors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API igång på http://localhost:${port}`);
}

bootstrap();
