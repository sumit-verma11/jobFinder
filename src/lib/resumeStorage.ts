import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const UPLOADS_DIR = join(process.cwd(), "uploads");

export async function saveResumeFile(
  file: File
): Promise<{ resumeFileName: string; resumeFilePath: string }> {
  await mkdir(UPLOADS_DIR, { recursive: true });

  const resumeFileName = basename(file.name);
  const resumeFilePath = join("uploads", resumeFileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(process.cwd(), resumeFilePath), buffer);

  return { resumeFileName, resumeFilePath };
}

export function resolveResumePath(filePath: string): string {
  return join(process.cwd(), filePath);
}

export async function readResumeFile(filePath: string): Promise<Uint8Array> {
  return readFile(resolveResumePath(filePath));
}
