import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROFILE_DIR = join(process.cwd(), "src", "profile");

export interface Profile {
  profileText: string;
  styleExamplesText: string;
}

export function loadProfile(): Profile {
  return {
    profileText: readProfileFile("profile.md"),
    styleExamplesText: readProfileFile("style-examples.md"),
  };
}

function readProfileFile(filename: string): string {
  const path = join(PROFILE_DIR, filename);
  try {
    return readFileSync(path, "utf-8");
  } catch {
    const template = filename.replace(".md", ".example.md");
    throw new Error(
      `${filename} not found at src/profile/${filename}. Copy src/profile/${template} to ${filename} and fill in your real details.`
    );
  }
}
