import { z } from "zod";
import { INTERVAL_UNITS, LOG_LEVELS } from "../../shared/types/api.js";

const RESERVED_ENV_KEYS = new Set(["__proto__", "prototype", "constructor", "get", "has", "toObject"]);

export const loginSchema = z.object({
  password: z.string().min(1, "Password is required").max(512),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required").max(512),
});

export const logoutSchema = z.object({
  refreshToken: z.string().max(512).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(512).optional(),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(512),
});

export const updateSettingsSchema = z
  .object({
    theme: z.enum(["dark", "light"]),
    logLevel: z.enum(LOG_LEVELS),
    maskCredentials: z.boolean(),
  })
  .partial();

export const updateSecretKeySchema = z.object({
  secretKey: z.string().trim().min(16, "Secret key must be at least 16 characters").max(512),
});

export const projectNameSchema = z.string().trim().min(1, "Name is required").max(80, "Name is too long");

export const createProjectSchema = z.object({ name: projectNameSchema });

export const updateProjectSchema = z
  .object({ name: projectNameSchema, logLevel: z.enum(LOG_LEVELS) })
  .partial()
  .refine((value) => value.name !== undefined || value.logLevel !== undefined, "Nothing to update");

export const scheduleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("none"),
  }),
  z.object({
    type: z.literal("cron"),
    cron: z.string().trim().min(1, "Cron expression is required").max(200),
  }),
  z.object({
    type: z.literal("interval"),
    intervalValue: z
      .number()
      .int("Interval must be a whole number")
      .min(1, "Interval must be at least 1")
      .max(1_000_000),
    intervalUnit: z.enum(INTERVAL_UNITS),
  }),
]);

export const saveCodeSchema = z.object({
  code: z.string().max(1_000_000, "Code is too large"),
});

export const envVarSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Key is required")
    .max(128)
    .regex(
      /^[A-Za-z_][A-Za-z0-9_]*$/,
      "Key may only contain letters, digits and underscores, and cannot start with a digit",
    )
    .refine((key) => !RESERVED_ENV_KEYS.has(key), "Key is reserved"),
  value: z.string().max(65_536),
  description: z.string().trim().max(500).default(""),
});

export const sqlQuerySchema = z.object({
  sql: z.string().trim().min(1, "SQL is required").max(100_000),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const runListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const runLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  level: z.enum(LOG_LEVELS).optional(),
});

export const appLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).optional(),
});
