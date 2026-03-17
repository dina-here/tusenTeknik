import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(configDir, "..");

loadEnv({ path: path.resolve(workspaceRoot, ".env") });
loadEnv({ path: path.resolve(workspaceRoot, ".env.local"), override: true });
loadEnv({ path: path.resolve(configDir, ".env") });
loadEnv({ path: path.resolve(configDir, ".env.local"), override: true });

export default defineConfig({
  schema: "./schema.prisma",
  migrations: {
    path: "./migrations",
    seed: "ts-node ./seed.ts"
  },
  datasource: {
    url: process.env.DATABASE_URL ?? ""
  }
});
