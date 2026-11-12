import type { NextFunction, Request, Response } from "express";
import { settingsRepository } from "../db/repositories/settingsRepository.js";
import { sessionService } from "./sessionService.js";

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  if (!sessionService.isAuthenticated(request)) {
    response.status(401).json({ error: "Bearer authentication required" });
    return;
  }

  const fullPath = `${request.baseUrl}${request.path}`;
  if (settingsRepository.get("must_change_password") === "true" && fullPath !== "/api/auth/change-password") {
    response.status(403).json({ error: "Password change required" });
    return;
  }

  next();
}
