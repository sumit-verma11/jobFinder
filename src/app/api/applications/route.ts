import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { jobId } = (await request.json()) as { jobId: string };

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const application = await db.application.create({
      data: { jobId, status: "SAVED" },
    });

    return NextResponse.json(application);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "An application already exists for this job" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
  }
}
