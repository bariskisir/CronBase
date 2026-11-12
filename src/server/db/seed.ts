import { settingsRepository } from "../db/repositories/settingsRepository.js";
import { logger } from "../logger/appLogger.js";
import { generatePassword, generateSecretKey, hashPassword } from "../auth/password.js";
import { projectService } from "../projects/projectService.js";
import { SAMPLE_PROJECT_CODE, SAMPLE_PROJECT_ENV, SAMPLE_PROJECT_NAME } from "../projects/projectTemplates.js";

function printFirstRunBanner(password: string | null, secretKey: string | null): void {
  const lines: string[] = ["CronBase first run initialization complete.", ""];
  if (password) {
    lines.push(`Admin Password : ${password}`);
  }
  if (secretKey) {
    lines.push(`Secret Key     : ${secretKey}`);
  }
  lines.push("", "Sign in with the password above. Both can be changed anytime in Settings.");

  const width = Math.max(...lines.map((line) => line.length)) + 4;
  const border = "=".repeat(width);
  console.log(`\n${border}`);
  for (const line of lines) console.log(`  ${line}`);
  console.log(`${border}\n`);
}

export function seedInitialData(): void {
  settingsRepository.ensureDefaults();

  let generatedPassword: string | null = null;
  let generatedSecretKey: string | null = null;

  if (settingsRepository.get("secret_key") === null) {
    generatedSecretKey = generateSecretKey();
    settingsRepository.set("secret_key", generatedSecretKey);
    logger.info("Generated initial secret key");
  }

  if (settingsRepository.get("password_hash") === null) {
    generatedPassword = generatePassword();
    settingsRepository.set("password_hash", hashPassword(generatedPassword));
    settingsRepository.set("must_change_password", "true");
    logger.info("Generated initial salted admin password");

    if (projectService.list().length === 0) {
      projectService.create({
        name: SAMPLE_PROJECT_NAME,
        code: SAMPLE_PROJECT_CODE,
        logLevel: "info",
        schedule: { type: "none" },
        env: SAMPLE_PROJECT_ENV,
      });
      logger.info("Created sample project", { name: SAMPLE_PROJECT_NAME });
    }
  }

  if (generatedPassword || generatedSecretKey) {
    printFirstRunBanner(generatedPassword, generatedSecretKey);
  }
}
