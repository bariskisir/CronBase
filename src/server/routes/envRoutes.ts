import { Router, type Response } from "express";
import type { EnvVar } from "../../shared/types/api.js";
import { envRepository } from "../db/repositories/envRepository.js";
import { HttpError, notFound, param, parse } from "../http/httpErrors.js";
import { envVarSchema } from "../http/schemas.js";
import { requireProject } from "./projectRoutes.js";

export const envRoutes = Router({ mergeParams: true });

envRoutes.get("/", (request, response: Response<EnvVar[]>) => {
  response.json(envRepository.list(requireProject(request).id));
});

envRoutes.post("/", (request, response: Response<EnvVar>) => {
  const project = requireProject(request);
  const input = parse(envVarSchema, request.body);
  if (envRepository.findByKey(project.id, input.key)) {
    throw new HttpError(409, `Variable "${input.key}" already exists`);
  }
  response.status(201).json(envRepository.create(project.id, input));
});

envRoutes.put("/:envId", (request, response: Response<EnvVar>) => {
  const project = requireProject(request);
  const envId = param(request, "envId");
  const input = parse(envVarSchema, request.body);
  const existing = envRepository.findByKey(project.id, input.key);
  if (existing && existing.id !== envId) {
    throw new HttpError(409, `Variable "${input.key}" already exists`);
  }
  const updated = envRepository.update(project.id, envId, input);
  if (!updated) throw notFound("Environment variable not found");
  response.json(updated);
});

envRoutes.delete("/:envId", (request, response) => {
  const project = requireProject(request);
  if (!envRepository.delete(project.id, param(request, "envId"))) {
    throw notFound("Environment variable not found");
  }
  response.status(204).end();
});
