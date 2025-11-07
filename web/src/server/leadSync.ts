import { Prisma, LeadSource, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchFacebookLeads } from "@/lib/facebook";
import { fetchGoogleAdsLeads } from "@/lib/googleAds";
import type { UnifiedLead } from "@/lib/types";

const INTEGRATION_KEYS = {
  facebook: "FACEBOOK_LAST_SYNC",
  google: "GOOGLE_LAST_SYNC",
} as const;

type IntegrationKey = (typeof INTEGRATION_KEYS)[keyof typeof INTEGRATION_KEYS];

type JsonRecord = Record<string, unknown>;

const sanitizePhone = (value?: string | null) => value?.replace(/\D/g, "") ?? undefined;

const coerceMetadata = (value?: Record<string, unknown>): Prisma.InputJsonValue | undefined => {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

const normalizeNull = (payload: unknown) => {
  if (payload === Prisma.DbNull || payload === Prisma.JsonNull) {
    return undefined;
  }
  return payload ?? undefined;
};

const mergeMetadata = (
  existing?: Prisma.JsonValue | null,
  incoming?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null | undefined,
): Prisma.InputJsonValue | undefined => {
  const toObject = (payload: unknown): JsonRecord | undefined => {
    const normalized = normalizeNull(payload);
    if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
      return undefined;
    }
    return normalized as JsonRecord;
  };

  const base = toObject(existing);
  const next = toObject(incoming);

  if (base || next) {
    const merged = {
      ...(base ?? {}),
      ...(next ?? {}),
    } as JsonRecord;
    return merged as Prisma.InputJsonValue;
  }

  const incomingValue = normalizeNull(incoming);
  if (incomingValue !== undefined) {
    return incomingValue as Prisma.InputJsonValue;
  }

  const existingValue = normalizeNull(existing);
  if (existingValue !== undefined) {
    return existingValue as Prisma.InputJsonValue;
  }

  return undefined;
};

const getLastSync = async (key: IntegrationKey) => {
  const state = await prisma.integrationState.findUnique({ where: { id: key } });
  if (!state?.value || typeof state.value !== "object") {
    return undefined;
  }
  const timestamp = (state.value as { lastSyncedAt?: string })?.lastSyncedAt;
  return timestamp ? new Date(timestamp) : undefined;
};

const updateLastSync = async (key: IntegrationKey, date?: Date) => {
  if (!date) return;
  await prisma.integrationState.upsert({
    where: { id: key },
    update: { value: { lastSyncedAt: date.toISOString() } },
    create: { id: key, value: { lastSyncedAt: date.toISOString() } },
  });
};

const normalizeLead = (lead: UnifiedLead): Prisma.LeadCreateInput => ({
  externalId: lead.externalId ?? undefined,
  fullName: lead.fullName ?? undefined,
  guardianName: lead.guardianName ?? undefined,
  phone: sanitizePhone(lead.phone),
  alternatePhone: sanitizePhone(lead.alternatePhone),
  email: lead.email ?? undefined,
  targetExam: lead.targetExam ?? undefined,
  city: lead.city ?? undefined,
  notes: lead.notes ?? undefined,
  source: lead.source as LeadSource,
  status: LeadStatus.NEW,
  metadata: coerceMetadata(lead.metadata as Record<string, unknown> | undefined),
});

const findLeadByContact = async (lead: UnifiedLead) => {
  const phone = sanitizePhone(lead.phone);
  if (phone) {
    const existing = await prisma.lead.findFirst({ where: { phone } });
    if (existing) return existing;
  }
  if (lead.email) {
    return prisma.lead.findFirst({ where: { email: lead.email } });
  }
  return null;
};

export const upsertUnifiedLead = async (lead: UnifiedLead) => {
  if (!lead.phone && !lead.email) {
    return null;
  }

  const normalized = normalizeLead(lead);
  const existingByExternal = lead.externalId
    ? await prisma.lead.findUnique({ where: { externalId: lead.externalId } })
    : null;

  if (existingByExternal) {
    return prisma.lead.update({
      where: { id: existingByExternal.id },
      data: {
        ...normalized,
        metadata: mergeMetadata(existingByExternal.metadata, normalized.metadata),
      },
    });
  }

  const existingByContact = await findLeadByContact(lead);

  if (existingByContact) {
    return prisma.lead.update({
      where: { id: existingByContact.id },
      data: {
        ...normalized,
        metadata: mergeMetadata(existingByContact.metadata, normalized.metadata),
      },
    });
  }

  return prisma.lead.create({
    data: normalized,
  });
};

export const syncLeads = async () => {
  const [facebookSince, googleSince] = await Promise.all([
    getLastSync(INTEGRATION_KEYS.facebook),
    getLastSync(INTEGRATION_KEYS.google),
  ]);

  const [facebookLeads, googleLeads] = await Promise.all([
    fetchFacebookLeads(facebookSince),
    fetchGoogleAdsLeads(googleSince),
  ]);

  const allLeads = [...facebookLeads, ...googleLeads];
  allLeads.sort((a, b) => {
    const aDate = a.createdAt?.getTime() ?? 0;
    const bDate = b.createdAt?.getTime() ?? 0;
    return aDate - bDate;
  });

  const processed = await Promise.all(allLeads.map((entry) => upsertUnifiedLead(entry)));

  const mostRecentFacebook = facebookLeads
    .map((entry) => entry.createdAt?.getTime() ?? 0)
    .sort((a, b) => b - a)[0];
  const mostRecentGoogle = googleLeads
    .map((entry) => entry.createdAt?.getTime() ?? 0)
    .sort((a, b) => b - a)[0];

  await Promise.all([
    updateLastSync(INTEGRATION_KEYS.facebook, mostRecentFacebook ? new Date(mostRecentFacebook) : undefined),
    updateLastSync(INTEGRATION_KEYS.google, mostRecentGoogle ? new Date(mostRecentGoogle) : undefined),
  ]);

  return {
    totalFetched: allLeads.length,
    facebookCount: facebookLeads.length,
    googleCount: googleLeads.length,
    upserted: processed.filter(Boolean).length,
  };
};
