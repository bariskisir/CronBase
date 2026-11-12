import { Router, type Response } from "express";
import type { SqliteQueryResult, SqliteTableInfo, SqliteTableRows } from "../../shared/types/api.js";
import { projectDatabase } from "../db/projectDatabase.js";
import { badRequest, notFound, param, parse } from "../http/httpErrors.js";
import { paginationSchema, sqlQuerySchema } from "../http/schemas.js";
import { logger } from "../logger/appLogger.js";
import { requireProject } from "./projectRoutes.js";

export const sqliteRoutes = Router({ mergeParams: true });

sqliteRoutes.get("/tables", (request, response: Response<SqliteTableInfo[]>) => {
  response.json(projectDatabase.listTables(requireProject(request).id));
});

sqliteRoutes.get("/tables/:table", (request, response: Response<SqliteTableRows>) => {
  const project = requireProject(request);
  const table = param(request, "table");
  if (!projectDatabase.tableExists(project.id, table)) throw notFound("Table not found");
  const { limit, offset } = parse(paginationSchema, request.query);
  response.json(projectDatabase.readTable(project.id, table, limit, offset));
});

sqliteRoutes.post("/query", (request, response: Response<SqliteQueryResult>) => {
  const project = requireProject(request);
  const { sql } = parse(sqlQuerySchema, request.body);
  try {
    const result = projectDatabase.runQuery(project.id, sql);
    logger.debug("SQLite query executed", { projectId: project.id, kind: result.kind });
    response.json(result);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : String(error));
  }
});
