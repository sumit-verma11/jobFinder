import { db } from "@/lib/db";
import { readResumeFile } from "@/lib/resumeStorage";

export async function GET() {
  const profile = await db.userProfile.findUnique({ where: { id: "default" } });

  if (!profile?.resumeFilePath || !profile.resumeFileName) {
    return new Response("No resume uploaded", { status: 404 });
  }

  const buffer = await readResumeFile(profile.resumeFilePath);

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${profile.resumeFileName}"`,
    },
  });
}
