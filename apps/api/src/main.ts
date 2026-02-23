import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Nest logger räcker för demo; kan bytas till pino senare.
    logger: ["log", "error", "warn"]
  });

  // Central felhantering (konsekvent JSON vid fel)
  app.useGlobalFilters(new AllExceptionsFilter());

  // ✅ DEMO: tillåt anrop från Vite-frontends
  app.enableCors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API igång på http://localhost:${port}`);
}

bootstrap();
