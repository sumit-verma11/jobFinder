import { db } from "@/lib/db";
import { DashboardStats } from "@/components/DashboardStats";
import { SavedJobCard } from "@/components/SavedJobCard";

export default async function SavedBoardPage() {
  const savedApplications = await db.application.findMany({
    where: { status: "SAVED" },
    include: { job: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Saved Jobs</h1>
      <DashboardStats />
      {savedApplications.length === 0 ? (
        <p className="text-sm text-slate-500">
          No saved jobs yet — save one from the <a href="/jobs" className="text-emerald-700 underline">Jobs</a> page.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {savedApplications.map((application) => (
            <SavedJobCard key={application.id} application={application} />
          ))}
        </div>
      )}
    </div>
  );
}
