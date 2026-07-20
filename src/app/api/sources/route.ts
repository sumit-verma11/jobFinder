import { NextResponse } from "next/server";
import type { AtsPlatform, SourceKind } from "@prisma/client";
import { db } from "@/lib/db";

export async function GET() {
  const sources = await db.source.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(sources);
}

interface CreateSourceBody {
  name?: string;
  kind?: SourceKind;
  url?: string;
  platform?: AtsPlatform;
  slug?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSourceBody;

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (body.kind === "CAREERS_PAGE") {
      if (!body.url || typeof body.url !== "string") {
        return NextResponse.json({ error: "url is required for CAREERS_PAGE sources" }, { status: 400 });
      }
    } else if (body.kind === "ATS") {
      if (!body.platform || !body.slug) {
        return NextResponse.json(
          { error: "platform and slug are required for ATS sources" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ error: "kind must be CAREERS_PAGE or ATS" }, { status: 400 });
    }

    const source = await db.source.create({
      data: {
        name: body.name,
        kind: body.kind,
        url: body.kind === "CAREERS_PAGE" ? body.url : null,
        platform: body.kind === "ATS" ? body.platform : null,
        slug: body.kind === "ATS" ? body.slug : null,
      },
    });

    return NextResponse.json(source);
  } catch {
    return NextResponse.json({ error: "Failed to create source" }, { status: 500 });
  }
}
