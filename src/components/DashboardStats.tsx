import { db } from "@/lib/db";

async function getStats() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const [total, appliedToday, appliedThisWeek, interviews, offers, rejections] = await Promise.all([
    db.application.count({ where: { status: { not: "SAVED" } } }),
    db.application.count({ where: { appliedAt: { gte: startOfToday } } }),
    db.application.count({ where: { appliedAt: { gte: startOfWeek } } }),
    db.application.count({ where: { status: { in: ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"] } } }),
    db.application.count({ where: { status: "OFFER" } }),
    db.application.count({ where: { status: "REJECTED" } }),
  ]);

  return { total, appliedToday, appliedThisWeek, interviews, offers, rejections };
}

export async function DashboardStats() {
  const stats = await getStats();

  const tiles = [
    { label: "Total Applications", value: stats.total },
    { label: "Applied Today", value: stats.appliedToday },
    { label: "Applied This Week", value: stats.appliedThisWeek },
    { label: "Interviews", value: stats.interviews },
    { label: "Offers", value: stats.offers },
    { label: "Rejections", value: stats.rejections },
  ];

  return (
    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
          <div className="text-2xl font-semibold text-emerald-700">{tile.value}</div>
          <div className="text-xs text-slate-600">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}
