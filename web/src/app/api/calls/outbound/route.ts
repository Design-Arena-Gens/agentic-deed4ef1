import { NextResponse } from "next/server";
import { z } from "zod";
import { initiateOutboundCall } from "@/server/outboundCall";

const payloadSchema = z.object({
  leadId: z.string().min(1),
});

const getBaseUrl = (request: Request) => {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host");
  if (!host) {
    throw new Error("Host header missing");
  }
  return `${proto}://${host}`;
};

export const POST = async (request: Request) => {
  try {
    const json = await request.json();
    const { leadId } = payloadSchema.parse(json);
    const baseUrl = getBaseUrl(request);
    const session = await initiateOutboundCall(leadId, baseUrl);
    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    const message = (error as Error).message ?? "Unable to initiate call";
    return NextResponse.json({ error: message }, { status: 400 });
  }
};
