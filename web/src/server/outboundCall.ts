import { CallDirection, CallStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTwilioClient } from "@/lib/twilio";
import { requireEnv } from "@/lib/env";

export const initiateOutboundCall = async (leadId: string, baseUrl: string) => {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead?.phone) {
    throw new Error("Lead phone number is required for outbound call");
  }

  const existing = await prisma.callSession.findFirst({
    where: { leadId, status: { in: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.IN_PROGRESS] } },
  });

  if (existing?.twilioSid) {
    return existing;
  }

  const callSession = await prisma.callSession.create({
    data: {
      leadId,
      direction: CallDirection.OUTBOUND,
      status: CallStatus.INITIATED,
    },
  });

  const client = getTwilioClient();
  const callbackUrl = new URL("/api/twilio/voice", baseUrl);
  callbackUrl.searchParams.set("leadId", leadId);
  callbackUrl.searchParams.set("sessionId", callSession.id);

  const call = await client.calls.create({
    to: lead.phone,
    from: requireEnv("TWILIO_CALLER_ID"),
    url: callbackUrl.toString(),
    statusCallback: new URL("/api/twilio/status", baseUrl).toString(),
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    machineDetection: "Enable",
  });

  await prisma.callSession.update({
    where: { id: callSession.id },
    data: {
      twilioSid: call.sid,
      status: CallStatus.RINGING,
    },
  });

  return callSession;
};
