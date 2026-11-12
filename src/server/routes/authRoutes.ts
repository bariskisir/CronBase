import { Router, type Response } from "express";
import type { AuthTokensResponse, SessionResponse } from "../../shared/types/api.js";
import { requireAuth } from "../auth/authMiddleware.js";
import { loginRateLimiter } from "../auth/loginRateLimiter.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { sessionService } from "../auth/sessionService.js";
import { settingsRepository } from "../db/repositories/settingsRepository.js";
import { HttpError, parse } from "../http/httpErrors.js";
import { changePasswordSchema, loginSchema, logoutSchema, refreshTokenSchema } from "../http/schemas.js";
import { logger } from "../logger/appLogger.js";

export const authRoutes = Router();

authRoutes.get("/session", (request, response: Response<SessionResponse>) => {
  const authenticated = sessionService.isAuthenticated(request);
  const mustChangePassword = authenticated && settingsRepository.get("must_change_password") === "true";
  response.json({ authenticated, mustChangePassword });
});

authRoutes.post("/login", (request, response: Response<AuthTokensResponse>) => {
  const clientKey = request.ip ?? "unknown";
  const locked = loginRateLimiter.remainingLock(clientKey);
  if (locked > 0) {
    throw new HttpError(429, `Too many failed attempts. Try again in ${Math.ceil(locked / 1000)} seconds.`);
  }

  const { password } = parse(loginSchema, request.body);
  const storedHash = settingsRepository.get("password_hash");
  if (!storedHash || !verifyPassword(password, storedHash)) {
    loginRateLimiter.recordFailure(clientKey);
    logger.warn("Failed login attempt", { ip: clientKey });
    throw new HttpError(401, "Invalid password");
  }

  loginRateLimiter.reset(clientKey);
  const tokens = sessionService.issueTokens();
  logger.info("User signed in", { ip: clientKey });
  response.json(tokens);
});

authRoutes.post("/refresh", (request, response: Response<AuthTokensResponse>) => {
  const { refreshToken } = parse(refreshTokenSchema, request.body);
  const tokens = sessionService.rotateRefreshToken(refreshToken);
  if (!tokens) {
    throw new HttpError(401, "Invalid or expired refresh token");
  }
  response.json(tokens);
});

authRoutes.post("/logout", (request, response: Response<SessionResponse>) => {
  const { refreshToken } = parse(logoutSchema, request.body ?? {});
  sessionService.revokeRefreshToken(refreshToken);
  response.json({ authenticated: false, mustChangePassword: false });
});

authRoutes.post("/change-password", requireAuth, (request, response: Response<AuthTokensResponse>) => {
  const clientKey = request.ip ?? "unknown";
  const locked = loginRateLimiter.remainingLock(clientKey);
  if (locked > 0) {
    throw new HttpError(429, `Too many failed attempts. Try again in ${Math.ceil(locked / 1000)} seconds.`);
  }

  const { currentPassword, newPassword } = parse(changePasswordSchema, request.body);
  const mustChange = settingsRepository.get("must_change_password") === "true";
  const storedHash = settingsRepository.get("password_hash");

  if (!mustChange) {
    if (!currentPassword || !storedHash || !verifyPassword(currentPassword, storedHash)) {
      loginRateLimiter.recordFailure(clientKey);
      throw new HttpError(400, "Current password is incorrect");
    }
  }

  loginRateLimiter.reset(clientKey);
  settingsRepository.set("password_hash", hashPassword(newPassword));
  settingsRepository.set("must_change_password", "false");
  const tokens = sessionService.resetAllAndIssueNew();
  logger.info("Password changed (salted & hashed)");
  response.json(tokens);
});
