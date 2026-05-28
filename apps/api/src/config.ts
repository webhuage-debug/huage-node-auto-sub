import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type AppConfig = {
  host: string;
  port: number;
  name: string;
  version: string;
};

export const appConfig: AppConfig = {
  host: process.env.APP_HOST || "0.0.0.0",
  port: Number(process.env.APP_PORT || 3000),
  name: "华哥自动节点订阅池",
  version: "v0.7.0"
};

export function findProjectFile(...segments: string[]): string {
  const candidates = [
    path.resolve(process.cwd(), ...segments),
    path.resolve(process.cwd(), "..", "..", ...segments),
    path.resolve(__dirname, "..", "..", "..", ...segments)
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found || candidates[0];
}

export function getWebDistDir(): string {
  return findProjectFile("apps", "web", "dist");
}

export function getConfigDir(): string {
  return findProjectFile("config");
}

export function resolveProjectPath(value: string): string {
  if (path.isAbsolute(value)) {
    return value;
  }

  return path.resolve(process.cwd(), value);
}
