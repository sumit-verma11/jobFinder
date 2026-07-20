import { db } from "@/lib/db";
import { SourcesTable } from "@/components/SourcesTable";

export default async function SourcesPage() {
  const sources = await db.source.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Sources</h1>
      <SourcesTable sources={sources} />
    </div>
  );
}
