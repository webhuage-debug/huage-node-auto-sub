import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function writeTempJsonFile(prefix: string, content: unknown): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const filePath = path.join(dir, "config.json");
  await fs.writeFile(filePath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return filePath;
}

export async function removeTempFile(filePath: string): Promise<void> {
  await fs.rm(path.dirname(filePath), { recursive: true, force: true });
}
