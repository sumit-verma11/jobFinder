import { db } from "@/lib/db";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const profile = await db.userProfile.findUnique({ where: { id: "default" } });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Settings</h1>
      <SettingsForm profile={profile} />
    </div>
  );
}
