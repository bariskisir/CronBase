import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Router, type Response } from "express";
import type {
  AppLogContentResponse,
  AppLogFilesResponse,
  AppSettings,
  SecretKeyResponse,
  UpdateSecretKeyResponse,
} from "../../shared/types/api.js";
import { generateSecretKey } from "../auth/password.js";
import { sessionService } from "../auth/sessionService.js";
import { paths } from "../config/paths.js";
import { settingsRepository } from "../db/repositories/settingsRepository.js";
import { badRequest, notFound, param, parse } from "../http/httpErrors.js";
import { appLogQuerySchema, updateSecretKeySchema, updateSettingsSchema } from "../http/schemas.js";
import { logger } from "../logger/appLogger.js";

const LOG_FILE_PATTERN = /^app-(\d{4}-\d{2}-\d{2})\.log$/;

export const settingsRoutes = Router();

settingsRoutes.get("/", (_request, response: Response<AppSettings>) => {
  response.json(settingsRepository.getAppSettings());
});

settingsRoutes.put("/", (request, response: Response<AppSettings>) => {
  const update = parse(updateSettingsSchema, request.body);
  if (update.theme) settingsRepository.set("theme", update.theme);
  if (update.maskCredentials !== undefined) {
    settingsRepository.set("mask_credentials", update.maskCredentials ? "true" : "false");
  }
  if (update.logLevel) {
    settingsRepository.set("log_level", update.logLevel);
    logger.setLevel(update.logLevel);
    logger.info("Log level changed", { logLevel: update.logLevel });
  }
  response.json(settingsRepository.getAppSettings());
});

settingsRoutes.get("/secret-key", (_request, response: Response<SecretKeyResponse>) => {
  const secretKey = settingsRepository.get("secret_key") ?? generateSecretKey();
  response.json({ secretKey });
});

settingsRoutes.put("/secret-key", (request, response: Response<UpdateSecretKeyResponse>) => {
  const { secretKey } = parse(updateSecretKeySchema, request.body);
  settingsRepository.set("secret_key", secretKey);
  const tokens = sessionService.resetAllAndIssueNew();
  logger.info("Application secret key updated");
  response.json({ secretKey, tokens });
});

settingsRoutes.post("/secret-key/regenerate", (_request, response: Response<UpdateSecretKeyResponse>) => {
  const secretKey = generateSecretKey();
  settingsRepository.set("secret_key", secretKey);
  const tokens = sessionService.resetAllAndIssueNew();
  logger.info("Application secret key regenerated");
  response.json({ secretKey, tokens });
});

settingsRoutes.get("/app-logs", (_request, response: Response<AppLogFilesResponse>) => {
  const files = existsSync(paths.logs)
    ? readdirSync(paths.logs)
        .map((file) => LOG_FILE_PATTERN.exec(file)?.[1])
        .filter((date): date is string => date !== undefined)
        .sort((a, b) => b.localeCompare(a))
    : [];
  response.json({ files });
});

settingsRoutes.get("/app-logs/:date", (request, response: Response<AppLogContentResponse>) => {
  const date = param(request, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest("Invalid date");

  const filePath = path.join(paths.logs, `app-${date}.log`);
  if (!existsSync(filePath)) throw notFound("Log file not found");

  const { limit, offset } = parse(appLogQuerySchema, request.query);
  const allLines = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
  const total = allLines.length;
  const defaultOffset = total === 0 ? 0 : Math.floor((total - 1) / limit) * limit;
  const resolvedOffset = offset === undefined ? defaultOffset : Math.min(offset, defaultOffset);
  response.json({
    date,
    lines: allLines.slice(resolvedOffset, resolvedOffset + limit),
    total,
    limit,
    offset: resolvedOffset,
  });
});
