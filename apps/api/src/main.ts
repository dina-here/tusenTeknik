import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { execSync } from "child_process";

async function bootstrap() {
  // Auto-run migrations on startup (needed for Render Free plan)
  try {
    console.log("Running Prisma migrations...");
    // Run from prisma workspace (from apps/api/dist -> go up 3 levels -> prisma)
    const prismaCwd = process.env.PRISMA_WORKSPACE_DIR || "/opt/render/project/src/prisma";
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
    credentials: true,
  });

  const port = process.env.NODE_ENV === 'production' ? 3000 : (Number(process.env.PORT) || 10000);
  await app.listen(port, "0.0.0.0");
  console.log(`API igång på http://0.0.0.0:${port}`);
}

bootstrap();
