import fs from "node:fs/promises";
import path from "node:path";
import { getConfigDir } from "../config.js";

export async function readJsonConfig<T>(fileName: string): Promise<T> {
  const filePath = path.join(getConfigDir(), fileName);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}
