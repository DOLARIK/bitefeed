import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  CERT_SIGNING_PRIVATE_KEY: z
    .string()
    .min(1, "CERT_SIGNING_PRIVATE_KEY is required (run scripts/generate-signing-keys.ts)"),
  CERT_SIGNING_PUBLIC_KEY: z
    .string()
    .min(1, "CERT_SIGNING_PUBLIC_KEY is required (run scripts/generate-signing-keys.ts)"),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_APP_SLUG: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  throw new Error("Fix the environment configuration (see .env.example) before starting the server.");
}

export const env = parsed.data;
