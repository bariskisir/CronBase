import { Router, type Request, type Response } from "express";
import type {
  ProjectDetail,
  ProjectSummary,
  ProjectVersionDetail,
  ProjectVersionSummary,
  SaveCodeResponse,
  SchedulePreview,
} from "../../shared/types/api.js";
import type { ProjectRecord } from "../db/repositories/projectRepository.js";
import { versionRepository } from "../db/repositories/versionRepository.js";
import { badRequest, notFound, param, parse } from "../http/httpErrors.js";
import { createProjectSchema, saveCodeSchema, scheduleSchema, updateProjectSchema } from "../http/schemas.js";
import { projectService } from "../projects/projectService.js";
import { assertValidSchedule, previewSchedule } from "../scheduler/scheduleParser.js";

export const projectRoutes = Router();

export function requireProject(request: Request): ProjectRecord {
  const project = projectService.find(param(request, "projectId"));
  if (!project) throw notFound("Project not found");
  return project;
}

function detailOf(projectId: string): ProjectDetail {
  const detail = projectService.getDetail(projectId);
  if (!detail) throw notFound("Project not found");
  return detail;
}

function versionParam(request: Request): number {
  const version = Number(param(request, "version"));
  if (!Number.isInteger(version) || version < 1) throw badRequest("Invalid version");
  return version;
}

projectRoutes.get("/", (_request, response: Response<ProjectSummary[]>) => {
  response.json(projectService.list());
});

projectRoutes.post("/", (request, response: Response<ProjectDetail>) => {
  const { name } = parse(createProjectSchema, request.body);
  const project = projectService.create({ name });
  response.status(201).json(detailOf(project.id));
});

projectRoutes.post("/schedule-preview", (request, response: Response<SchedulePreview>) => {
  response.json(previewSchedule(parse(scheduleSchema, request.body)));
});

projectRoutes.get("/:projectId", (request, response: Response<ProjectDetail>) => {
  response.json(detailOf(requireProject(request).id));
});

projectRoutes.patch("/:projectId", (request, response: Response<ProjectDetail>) => {
  const project = requireProject(request);
  const update = parse(updateProjectSchema, request.body);
  if (update.name !== undefined) projectService.rename(project.id, update.name);
  if (update.logLevel !== undefined && update.logLevel !== project.logLevel) {
    projectService.setLogLevel(project.id, update.logLevel);
  }
  response.json(detailOf(project.id));
});

projectRoutes.delete("/:projectId", async (request, response) => {
  const project = requireProject(request);
  await projectService.delete(project.id);
  response.status(204).end();
});

projectRoutes.put("/:projectId/schedule", (request, response: Response<ProjectDetail>) => {
  const project = requireProject(request);
  const schedule = parse(scheduleSchema, request.body);
  try {
    assertValidSchedule(schedule);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "Invalid schedule");
  }
  projectService.updateSchedule(project.id, schedule);
  response.json(detailOf(project.id));
});

projectRoutes.put("/:projectId/code", (request, response: Response<SaveCodeResponse>) => {
  const project = requireProject(request);
  const { code } = parse(saveCodeSchema, request.body);
  response.json(projectService.saveCode(project.id, code));
});

projectRoutes.get("/:projectId/versions", (request, response: Response<ProjectVersionSummary[]>) => {
  response.json(versionRepository.list(requireProject(request).id));
});

projectRoutes.get("/:projectId/versions/:version", (request, response: Response<ProjectVersionDetail>) => {
  const version = versionRepository.find(requireProject(request).id, versionParam(request));
  if (!version) throw notFound("Version not found");
  response.json(version);
});

projectRoutes.post("/:projectId/versions/:version/restore", (request, response: Response<SaveCodeResponse>) => {
  const project = requireProject(request);
  const version = versionRepository.find(project.id, versionParam(request));
  if (!version) throw notFound("Version not found");
  response.json(projectService.saveCode(project.id, version.code));
});

projectRoutes.delete("/:projectId/versions/:version", (request, response: Response<ProjectDetail>) => {
  const project = requireProject(request);
  const version = versionParam(request);
  if (versionRepository.count(project.id) <= 1) {
    throw badRequest("Cannot delete the only version of a project");
  }
  const deleted = versionRepository.delete(project.id, version);
  if (!deleted) throw notFound("Version not found");
  response.json(detailOf(project.id));
});
