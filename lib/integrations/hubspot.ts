// HubSpot free CRM: every caller becomes a contact; every call worth a designer's time becomes a deal
// whose amount is the internal indicative band midpoint. Needs a private-app token (HUBSPOT_TOKEN)
// with scopes crm.objects.contacts.read/write and crm.objects.deals.read/write.

import type { SyncStatus } from "../db";

const BASE = "https://api.hubapi.com";

async function hs<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`, "Content-Type": "application/json", ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HubSpot ${res.status} on ${path}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

type Stage = { id: string; label: string };
let stagesCache: { pipeline: string; stages: Stage[] } | null = null;

/** Reads the default deal pipeline once, so stage ids are never hard-coded. */
async function dealStages() {
  if (stagesCache) return stagesCache;
  const res = await hs<{ results: { id: string; label: string; displayOrder: number; stages: (Stage & { displayOrder: number })[] }[] }>(
    "/crm/v3/pipelines/deals",
  );
  const pipe = res.results.find((p) => p.id === "default") ?? res.results.sort((a, b) => a.displayOrder - b.displayOrder)[0];
  if (!pipe) throw new Error("No deal pipeline found in HubSpot");
  stagesCache = { pipeline: pipe.id, stages: [...pipe.stages].sort((a, b) => a.displayOrder - b.displayOrder) };
  return stagesCache;
}

async function stageFor(booked: boolean) {
  const { pipeline, stages } = await dealStages();
  const pick = (re: RegExp) => stages.find((s) => re.test(s.label));
  const stage = (booked ? pick(/appointment|meeting|consult/i) : pick(/qualified/i)) ?? stages[0];
  return { pipeline, stage: stage.id, label: stage.label };
}

async function findOrCreateContact(c: { phone: string | null; name: string | null; city: string | null; locality: string | null }) {
  if (c.phone) {
    const found = await hs<{ results: { id: string }[] }>("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "phone", operator: "EQ", value: c.phone }] }], limit: 1 }),
    });
    if (found.results[0]) return { id: found.results[0].id, created: false };
  }
  const [first, ...rest] = (c.name ?? "Unknown caller").trim().split(/\s+/);
  const created = await hs<{ id: string }>("/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        firstname: first,
        lastname: rest.join(" ") || undefined,
        phone: c.phone ?? undefined,
        city: c.city ?? (c.locality ? "Pune" : undefined),
        lifecyclestage: "lead",
      },
    }),
  });
  return { id: created.id, created: true };
}

export type DealInput = {
  phone: string | null;
  name: string | null;
  city: string | null;
  locality: string | null;
  createDeal: boolean;
  dealName: string;
  amount: number | null;
  closeDate: Date;
  description: string;
  booked: boolean;
};

export async function syncToHubspot(input: DealInput): Promise<SyncStatus> {
  const at = new Date().toISOString();
  if (!process.env.HUBSPOT_TOKEN) {
    return { status: "dry_run", at, detail: input.createDeal ? `Would create contact + deal "${input.dealName}"` : "Would create contact" };
  }
  const contact = await findOrCreateContact(input);
  if (!input.createDeal) return { status: "sent", at, contact_id: contact.id, detail: contact.created ? "Contact created" : "Existing contact" };

  const { pipeline, stage, label } = await stageFor(input.booked);
  const deal = await hs<{ id: string }>("/crm/v3/objects/deals", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        dealname: input.dealName,
        pipeline,
        dealstage: stage,
        amount: input.amount != null ? String(Math.round(input.amount)) : undefined,
        closedate: input.closeDate.toISOString(),
        description: input.description.slice(0, 5000),
      },
    }),
  });
  await hs(`/crm/v4/objects/deals/${deal.id}/associations/default/contacts/${contact.id}`, { method: "PUT" });
  return { status: "sent", at, contact_id: contact.id, deal_id: deal.id, detail: `Deal in "${label}"` };
}

/** Moves an existing deal to the booked stage once a consultation is on the calendar. */
export async function markDealBooked(dealId: string): Promise<string> {
  const { stage, label } = await stageFor(true);
  await hs(`/crm/v3/objects/deals/${dealId}`, { method: "PATCH", body: JSON.stringify({ properties: { dealstage: stage } }) });
  return label;
}
