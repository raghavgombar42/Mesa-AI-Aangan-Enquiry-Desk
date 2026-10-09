"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/calls", label: "Calls" },
  { href: "/simulate", label: "Simulate a call" },
  { href: "/setup", label: "Setup & rules" },
];

export function Nav({ logout }: { logout: React.ReactNode }) {
  const path = usePathname();
  if (path === "/login") return null;
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-emerald-900 text-xs font-bold text-white">A</span>
          <span className="whitespace-nowrap font-semibold tracking-tight">Aangan Enquiry Desk</span>
        </Link>
        <nav className="flex gap-1 self-stretch overflow-x-auto">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center whitespace-nowrap border-b-2 px-3 ${active(l.href) ? "border-emerald-900 font-medium text-stone-900" : "border-transparent text-stone-500 hover:text-stone-900"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden whitespace-nowrap text-right leading-tight lg:block">
            <div className="font-medium">Nikhil Deshpande</div>
            <div className="text-xs text-stone-500">Aangan Studio</div>
          </div>
          {logout}
        </div>
      </div>
    </header>
  );
}
