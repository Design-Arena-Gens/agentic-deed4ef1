import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { upsertUnifiedLead } from "@/server/leadSync";

export const POST = async (request: Request) => {
  const payload = await request.json();
  const lead = {
    externalId: payload.lead_id ?? payload.gclid ?? randomUUID(),
    source: "GOOGLE" as const,
    fullName: payload.full_name ?? payload.name,
    phone: payload.phone_number ?? payload.phone,
    email: payload.email,
    city: payload.city,
    targetExam: payload.target_exam ?? payload.exam,
    metadata: payload,
    createdAt: payload.inserted_at ? new Date(payload.inserted_at) : new Date(),
  };

  await upsertUnifiedLead(lead);

  return NextResponse.json({ success: true });
};

export const GET = async () => NextResponse.json({ ok: true });
