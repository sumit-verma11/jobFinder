import { NextResponse } from "next/server";
import type { AppStatus } from "@prisma/client";
import { db } from "@/lib/db";

interface BulkBody {
  ids: string[];
  action: "delete" | "archive" | "status";
  status?: AppStatus;
}

export async function POST(request: Request) {
  const { ids, action, status } = (await request.json()) as BulkBody;

  if (action === "delete") {
    await db.application.deleteMany({ where: { id: { in: ids } } });
  } else if (action === "archive") {
    await db.application.updateMany({ where: { id: { in: ids } }, data: { archived: true } });
  } else if (action === "status" && status) {
    await db.application.updateMany({ where: { id: { in: ids } }, data: { status } });
  }

  return NextResponse.json({ ok: true });
}
