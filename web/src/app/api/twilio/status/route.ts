import { NextResponse } from "next/server";
import { CallStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const parseBody = async (request: Request) => {
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

const statusMap: Record<string, CallStatus> = {
  initiated: CallStatus.INITIATED,
  ringing: CallStatus.RINGING,
  answered: CallStatus.IN_PROGRESS,
  completed: CallStatus.COMPLETED,
  busy: CallStatus.FAILED,
  failed: CallStatus.FAILED,
  "no-answer": CallStatus.FAILED,
};

export const POST = async (request: Request) => {
  const body = await parseBody(request);
  const callSid = body.CallSid;
  const callStatus = body.CallStatus?.toLowerCase();

  if (!callSid || !callStatus) {
    return NextResponse.json({ ok: true });
  }

  const status = statusMap[callStatus];
  if (!status) {
    return NextResponse.json({ ok: true });
  }

  await prisma.callSession.updateMany({
    where: { twilioSid: callSid },
    data: { status },
  });

  return NextResponse.json({ ok: true });
};

export const GET = POST;
