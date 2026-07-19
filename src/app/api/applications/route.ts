import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const { jobId } = (await request.json()) as { jobId: string };

  const application = await db.application.create({
    data: { jobId, status: "SAVED" },
  });

  return NextResponse.json(application);
}
