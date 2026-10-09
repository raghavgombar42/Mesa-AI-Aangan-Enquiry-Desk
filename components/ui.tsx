import type { SyncStatus } from "@/lib/db";
import { ROUTE_LABEL, type Route, type Verdict } from "@/lib/rules";

const ROUTE_TONE: Record<Route, string> = {
  book: "bg-emerald-100 text-emerald-800",
  book_note: "bg-amber-100 text-amber-800",
  close: "bg-stone-200 text-stone-700",
  nurture: "bg-sky-100 text-sky-800",
  escalate: "bg-red-100 text-red-800",
  incomplete: "bg-violet-100 text-violet-800",
};

export function RouteBadge({ route, overridden }: { route: Route | null; overridden?: boolean }) {
  if (!route) return <span className="text-stone-400">…</span>;
  return (
    <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${ROUTE_TONE[route]}`}>
      {ROUTE_LABEL[route]}
      {overridden && " (overridden)"}
    </span>
  );
}

export function VerdictDot({ v }: { v: Verdict }) {
  const s = { pass: ["✓", "bg-emerald-600 text-white"], fail: ["✗", "bg-red-600 text-white"], unclear: ["?", "bg-amber-300 text-amber-950"] }[v];
  return <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s[1]}`}>{s[0]}</span>;
}

export function SyncBadge({ label, s }: { label: string; s: SyncStatus }) {
  const tone =
    s.status === "sent" ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : s.status === "failed" ? "bg-red-50 text-red-800 ring-red-200"
    : s.status === "dry_run" ? "bg-amber-50 text-amber-800 ring-amber-200"
    : "bg-stone-50 text-stone-500 ring-stone-200";
  const text = s.status === "sent" ? "sent" : s.status === "failed" ? "failed" : s.status === "dry_run" ? "dry run" : s.status === "skipped" ? "skipped" : "pending";
  return (
    <span title={s.error ?? s.detail} className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs ring-1 ${tone}`}>
      {label}: {text}
    </span>
  );
}

export function Card({ title, children, className = "", action }: { title?: React.ReactNode; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`rounded-lg border border-stone-200 bg-white p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-0.5 font-mono text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: n < 100 ? 2 : 0 })}`;

export function when(iso: string | null, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) {
  return iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...opts }) : "—";
}
