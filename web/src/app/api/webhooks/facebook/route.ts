import axios from "axios";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { parseFacebookLead } from "@/lib/facebook";
import { upsertUnifiedLead } from "@/server/leadSync";

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.FACEBOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
};

export const POST = async (request: Request) => {
  if (!env.FACEBOOK_ACCESS_TOKEN) {
    return NextResponse.json({ success: false, reason: "facebook integration disabled" });
  }

  const payload = await request.json();

  const entries = payload?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const leadgenId = change.value?.leadgen_id;
      if (!leadgenId) continue;
      const response = await axios.get(`https://graph.facebook.com/v19.0/${leadgenId}`, {
        params: {
          access_token: env.FACEBOOK_ACCESS_TOKEN,
          fields: "id,created_time,field_data",
        },
      });
      const fbLead = response.data;
      const unified = parseFacebookLead(fbLead);
      await upsertUnifiedLead(unified);
    }
  }

  return NextResponse.json({ success: true });
};
