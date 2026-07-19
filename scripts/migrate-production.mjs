import { spawnSync } from "node:child_process";
import path from "node:path";

if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be configured before a production deployment.");
  }

  console.log("Applying production database migrations...");
  const drizzleCli = path.join(process.cwd(), "node_modules", "drizzle-kit", "bin.cjs");
  const migration = spawnSync(process.execPath, [drizzleCli, "migrate"], {
    env: process.env,
    stdio: "inherit",
  });

  if (migration.error) throw migration.error;
  if (migration.status !== 0) {
    throw new Error(`Production database migration failed with exit code ${migration.status ?? "unknown"}.`);
  }
}
