import { NextResponse } from "next/server";
import type { AppStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

interface UpdateBody {
  status?: AppStatus;
  notes?: string;
  followUpAt?: string | null;
  archived?: boolean;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = (await request.json()) as UpdateBody;
  const data: Prisma.ApplicationUpdateInput = {};

  if (body.status !== undefined) {
    data.status = body.status;

    if (body.status === "APPLIED") {
      const existing = await db.application.findUnique({ where: { id: params.id } });
      if (existing && !existing.appliedAt) {
        data.appliedAt = new Date();
      }
    }
  }

  if (body.notes !== undefined) {
    data.notes = body.notes;
  }

  if (body.followUpAt !== undefined) {
    data.followUpAt = body.followUpAt ? new Date(body.followUpAt) : null;
  }

  if (body.archived !== undefined) {
    data.archived = body.archived;
  }

  const application = await db.application.update({ where: { id: params.id }, data });
  return NextResponse.json(application);
}
