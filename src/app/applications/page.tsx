import { db } from "@/lib/db";
import { ApplicationsTable } from "@/components/ApplicationsTable";

export default async function ApplicationsPage() {
  const applications = await db.application.findMany({
    where: { status: { not: "SAVED" } },
    include: { job: true },
    orderBy: { appliedAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Applications</h1>
      <ApplicationsTable applications={applications} />
    </div>
  );
}
