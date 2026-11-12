import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { logger } from "../logger/appLogger.js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function notFound(message = "Not found"): HttpError {
  return new HttpError(404, message);
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message);
}

export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue && issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    throw badRequest(`${field}${issue?.message ?? "Invalid request"}`);
  }
  return result.data;
}

export function param(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== "string" || value.length === 0) throw badRequest(`Missing parameter: ${name}`);
  return value;
}

export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction): void {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: "Malformed JSON body" });
    return;
  }
  logger.error("Unhandled request error", {
    method: request.method,
    path: request.path,
    error: error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
  response.status(500).json({ error: "Internal server error" });
}
