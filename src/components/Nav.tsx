"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Saved" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/sources", label: "Sources" },
  { href: "/settings", label: "Settings" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-emerald-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
        <span className="text-lg font-semibold text-emerald-700">JobPilot</span>
        <div className="flex gap-4">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? "rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700"
                    : "rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
