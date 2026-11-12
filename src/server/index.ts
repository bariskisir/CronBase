import type { Server } from "node:http";
import { createApp } from "./app.js";
import { ensureDirectories } from "./config/paths.js";
import { closeAppDatabase, getAppDatabase } from "./db/appDatabase.js";
import { runRepository } from "./db/repositories/runRepository.js";
import { settingsRepository } from "./db/repositories/settingsRepository.js";
import { seedInitialData } from "./db/seed.js";
import { logger } from "./logger/appLogger.js";
import { scheduler } from "./scheduler/schedulerEngine.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

function bootstrap(): Server {
  ensureDirectories();
  getAppDatabase();

  logger.setLevel(settingsRepository.getAppSettings().logLevel);
  seedInitialData();

  const interrupted = runRepository.failInterruptedRuns();
  if (interrupted > 0) logger.warn("Marked interrupted runs as failed", { count: interrupted });

  scheduler.start();

  const server = createApp().listen(PORT, HOST, () => {
    logger.info(`CronBase listening on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  });
  return server;
}

const server = bootstrap();

function shutdown(signal: string): void {
  logger.info("Shutting down", { signal });
  scheduler.stop();
  server.close(() => {
    closeAppDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
