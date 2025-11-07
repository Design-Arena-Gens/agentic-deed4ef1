import { NextResponse } from "next/server";
import twilio from "twilio";
import { CallDirection, CallStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleCallTurn, markCallCompleted } from "@/server/voiceAgent";

const { VoiceResponse } = twilio.twiml;

const buildResponse = (message: string, expectResponse: boolean, actionUrl: string) => {
  const twiml = new VoiceResponse();

  if (expectResponse) {
    const gather = twiml.gather({
      input: ["speech"],
      action: actionUrl,
      method: "POST",
      speechTimeout: "auto",
      language: "en-IN",
    });
    gather.say({ voice: "Polly.Aditi", language: "en-IN" }, message);
    twiml.pause({ length: 1 });
  } else {
    twiml.say({ voice: "Polly.Aditi", language: "en-IN" }, message);
    twiml.pause({ length: 1 });
    twiml.say({ voice: "Polly.Aditi", language: "en-IN" }, "Dhanyavaad! We will follow up with the demo details. Have a great day.");
    twiml.hangup();
  }

  return twiml.toString();
};

const resolveLeadId = async (leadIdFromQuery: string | null, fromNumber?: string | null) => {
  if (leadIdFromQuery) {
    return leadIdFromQuery;
  }

  if (!fromNumber) {
    return null;
  }

  const normalized = fromNumber.replace(/\D/g, "");
  const lead = await prisma.lead.findFirst({
    where: { phone: normalized },
  });
  return lead?.id ?? null;
};

const parseFormData = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    const result: Record<string, string> = {};
    formData.forEach((value, key) => {
      result[key] = String(value);
    });
    return result;
  }

  try {
    return (await request.json()) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
};

const xmlResponse = (body: string) =>
  new NextResponse(body, {
    headers: {
      "Content-Type": "text/xml",
    },
  });

export const POST = async (request: Request) => {
  const query = new URL(request.url).searchParams;
  const form = await parseFormData(request);

  const callSid = form.CallSid ?? query.get("CallSid");
  const status = form.CallStatus;

  if (status && callSid) {
    const statusMap: Record<string, CallStatus> = {
      completed: CallStatus.COMPLETED,
      busy: CallStatus.FAILED,
      failed: CallStatus.FAILED,
      "no-answer": CallStatus.FAILED,
    };
    const resolved = statusMap[status];
    if (resolved) {
      await markCallCompleted(callSid, resolved);
    }
  }

  const leadId = await resolveLeadId(query.get("leadId"), form.From ?? form.Caller);

  if (!leadId) {
    const twiml = new VoiceResponse();
    twiml.say({ voice: "Polly.Aditi", language: "en-IN" }, "Sorry, we could not locate your record. Our team will call you back soon.");
    twiml.hangup();
    return xmlResponse(twiml.toString());
  }

  const transcription = form.SpeechResult ?? form.TranscriptionText;

  const baseActionUrl = (() => {
    const url = new URL(request.url);
    url.searchParams.set("leadId", leadId);
    const sessionId = query.get("sessionId");
    if (sessionId) {
      url.searchParams.set("sessionId", sessionId);
    }
    return url.toString();
  })();

  const direction = form.Direction === "inbound" ? CallDirection.INBOUND : CallDirection.OUTBOUND;

  const result = await handleCallTurn({
    leadId,
    twilioSid: callSid ?? undefined,
    transcription: transcription ?? undefined,
    direction,
  });

  const xml = buildResponse(result.message, result.expectResponse, baseActionUrl);
  return xmlResponse(xml);
};

export const GET = POST;
