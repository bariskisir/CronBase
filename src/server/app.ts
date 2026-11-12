import { existsSync } from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import { requireAuth } from "./auth/authMiddleware.js";
import { paths } from "./config/paths.js";
import { errorHandler, notFound } from "./http/httpErrors.js";
import { authRoutes } from "./routes/authRoutes.js";
import { envRoutes } from "./routes/envRoutes.js";
import { projectRoutes } from "./routes/projectRoutes.js";
import { projectRunRoutes, runRoutes } from "./routes/runRoutes.js";
import { settingsRoutes } from "./routes/settingsRoutes.js";
import { sqliteRoutes } from "./routes/sqliteRoutes.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  if (process.env.CRONBASE_TRUST_PROXY === "true") app.set("trust proxy", true);

  app.use(express.json({ limit: "2mb" }));
  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "same-origin");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    next();
  });

  const api = express.Router();
  api.use("/auth", authRoutes);
  api.use(requireAuth);
  api.use("/settings", settingsRoutes);
  api.use("/projects/:projectId/env", envRoutes);
  api.use("/projects/:projectId/runs", projectRunRoutes);
  api.use("/projects/:projectId/sqlite", sqliteRoutes);
  api.use("/projects", projectRoutes);
  api.use("/runs", runRoutes);
  api.use(() => {
    throw notFound("Endpoint not found");
  });

  app.use("/api", (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api", api);

  if (existsSync(paths.clientDist)) {
    app.use(express.static(paths.clientDist, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/api\/).*/, (_request, response) => {
      response.sendFile(path.join(paths.clientDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
