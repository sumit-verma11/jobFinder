import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const UPLOADS_DIR = join(process.cwd(), "uploads");

export async function saveResumeFile(file: File): Promise<{ fileName: string; filePath: string }> {
  await mkdir(UPLOADS_DIR, { recursive: true });

  const fileName = file.name;
  const filePath = join("uploads", fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(process.cwd(), filePath), buffer);

  return { fileName, filePath };
}

export function resolveResumePath(filePath: string): string {
  return join(process.cwd(), filePath);
}

export async function readResumeFile(filePath: string): Promise<Uint8Array> {
  return readFile(resolveResumePath(filePath));
}
