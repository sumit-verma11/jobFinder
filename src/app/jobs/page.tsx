import { db } from "@/lib/db";
import { JobsTable } from "@/components/JobsTable";

export default async function JobsPage() {
  const jobs = await db.job.findMany({
    include: { application: true },
    orderBy: { collectedAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">All Jobs</h1>
      <JobsTable jobs={jobs} />
    </div>
  );
}
