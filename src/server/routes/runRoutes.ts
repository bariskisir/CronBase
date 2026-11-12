import { Router, type Response } from "express";
import type { RunDetail, RunSummary, StartRunResponse } from "../../shared/types/api.js";
import { runRepository } from "../db/repositories/runRepository.js";
import { HttpError, notFound, param, parse } from "../http/httpErrors.js";
import { runListQuerySchema } from "../http/schemas.js";
import { projectRunner } from "../runner/projectRunner.js";
import { requireProject } from "./projectRoutes.js";

export const projectRunRoutes = Router({ mergeParams: true });

projectRunRoutes.get("/", (request, response: Response<RunSummary[]>) => {
  const project = requireProject(request);
  const { limit, before } = parse(runListQuerySchema, request.query);
  response.json(runRepository.list(project.id, limit, before ?? null));
});

projectRunRoutes.post("/", (request, response: Response<StartRunResponse>) => {
  const project = requireProject(request);
  if (projectRunner.isRunning(project.id)) {
    throw new HttpError(409, "Project is already running");
  }
  const runId = projectRunner.start(project.id, "manual");
  response.status(202).json({ runId });
});

projectRunRoutes.delete("/", (request, response) => {
  runRepository.clear(requireProject(request).id);
  response.status(204).end();
});

export const runRoutes = Router();

runRoutes.get("/:runId", (request, response: Response<RunDetail>) => {
  const run = runRepository.find(param(request, "runId"));
  if (!run) throw notFound("Run not found");
  response.json(run);
});
