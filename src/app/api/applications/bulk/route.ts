import { NextResponse } from "next/server";
import type { AppStatus } from "@prisma/client";
import { db } from "@/lib/db";

interface BulkBody {
  ids: string[];
  action: "delete" | "archive" | "status";
  status?: AppStatus;
}

export async function POST(request: Request) {
  try {
    const { ids, action, status } = (await request.json()) as BulkBody;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }

    if (action !== "delete" && action !== "archive" && action !== "status") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "status" && !status) {
      return NextResponse.json(
        { error: "status is required for the status action" },
        { status: 400 }
      );
    }

    if (action === "delete") {
      await db.application.deleteMany({ where: { id: { in: ids } } });
    } else if (action === "archive") {
      await db.application.updateMany({ where: { id: { in: ids } }, data: { archived: true } });
    } else if (action === "status") {
      await db.application.updateMany({ where: { id: { in: ids } }, data: { status } });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bulk action failed" }, { status: 500 });
  }
}

