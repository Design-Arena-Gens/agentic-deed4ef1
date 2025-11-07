import { LeadStatus, CallDirection, CallStatus, TaskStatus } from "@prisma/client";
import { getOpenAIClient } from "@/lib/openai";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `You are "Ananya", a warm, empathetic, and confident female admissions advisor for a residential coaching institute that prepares students for Sainik School, Rashtriya Military School, and Navodaya Vidyalaya entrance exams.

Goals:
1. Build trust quickly with the parent or student.
2. Understand the student's current class, target exam (Sainik, RMS, or Navodaya), and exam attempt timeline.
3. Explain key benefits: expert faculty (ex-defence officers and alum mentors), personalised study plans, disciplined environment, mock tests, bilingual support (English & Hindi), parent progress reports.
4. Offer a free, no-obligation demo class and secure a confirmed schedule (date & preferred time).
5. Collect alternate contact details (parent name, WhatsApp) if available.
6. Always recap commitments and next steps.

Style:
- Speak conversationally, 3-4 short sentences max per turn.
- Be proactive, handle objections, and keep control of the call.
- Default to English with Hinglish tone. You may mix polite Hindi phrases naturally.
- Never mention you are an AI.

Output a JSON object with fields:
- message: string (what you will say)
- expect_response: boolean (true if you expect the caller to reply)
- lead_status: one of ["NEW","CONTACTED","QUALIFIED","DEMO_SCHEDULED","DEMO_COMPLETED","ENROLLED","CLOSED_LOST"]
- schedule_demo: object | null with keys { accepted: boolean, proposed_date?: string (YYYY-MM-DD), proposed_time?: string (HH:MM 24hr), notes?: string }
- summary_note: string brief summary for CRM
- updated_lead: object with optional keys [fullName, guardianName, phone, alternatePhone, email, targetExam, city, notes]
`;

type CallStatePayload = {
  leadId: string;
  callSessionId: string;
  transcript: { role: "agent" | "lead"; content: string }[];
};

const ensureCallSession = async (
  leadId: string,
  params: { direction: CallDirection; twilioSid?: string },
) => {
  const existing = params.twilioSid
    ? await prisma.callSession.findFirst({ where: { twilioSid: params.twilioSid } })
    : await prisma.callSession.findFirst({ where: { leadId, status: { not: CallStatus.COMPLETED } } });

  if (existing) {
    return existing;
  }

  return prisma.callSession.create({
    data: {
      leadId,
      direction: params.direction,
      status: CallStatus.INITIATED,
      twilioSid: params.twilioSid,
    },
  });
};

const buildOpenAIInput = async (state: CallStatePayload) => {
  const lead = await prisma.lead.findUnique({ where: { id: state.leadId } });
  if (!lead) {
    throw new Error("Lead not found");
  }

  return {
    lead,
    transcript: state.transcript,
  };
};

const FALLBACK_SCRIPT = (
  transcript: CallStatePayload["transcript"],
  leadName?: string | null,
) => {
  if (transcript.length === 0) {
    return {
      message: `Namaste${leadName ? ` ${leadName}` : ""}! I am Ananya from Strategic Scholars Academy. We help students crack Sainik, RMS, and Navodaya entrance exams. Have you enrolled your child for the upcoming attempt?`,
      expect_response: true,
      lead_status: LeadStatus.CONTACTED,
      schedule_demo: null,
      summary_note: "Introduced institute",
      updated_lead: {},
    };
  }
  if (transcript.length === 1 && transcript[0].role === "lead") {
    return {
      message: "Great! Let me quickly share how our free demo class works and why parents love it. Shall I book a slot for you this week?",
      expect_response: true,
      lead_status: LeadStatus.QUALIFIED,
      schedule_demo: null,
      summary_note: "Asked to book demo",
      updated_lead: {},
    };
  }
  return {
    message: "We offer a personalised study roadmap, defence expert mentors, and weekly mock tests. Our demo class is free—can I schedule it for the next available evening slot?",
    expect_response: true,
    lead_status: LeadStatus.QUALIFIED,
    schedule_demo: null,
    summary_note: "Reiterated value and demo CTA",
    updated_lead: {},
  };
};

const callCompletionWithOpenAI = async (payload: CallStatePayload) => {
  const openai = getOpenAIClient();
  const input = await buildOpenAIInput(payload);

  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    stream: false,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "CallTurn",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["message", "expect_response", "lead_status", "summary_note"],
          properties: {
            message: { type: "string" },
            expect_response: { type: "boolean" },
            lead_status: {
              type: "string",
              enum: [
                "NEW",
                "CONTACTED",
                "QUALIFIED",
                "DEMO_SCHEDULED",
                "DEMO_COMPLETED",
                "ENROLLED",
                "CLOSED_LOST",
              ],
            },
            schedule_demo: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["accepted"],
                  properties: {
                    accepted: { type: "boolean" },
                    proposed_date: { type: "string" },
                    proposed_time: { type: "string" },
                    notes: { type: "string" },
                  },
                },
              ],
            },
            summary_note: { type: "string" },
            updated_lead: {
              type: "object",
              additionalProperties: false,
              properties: {
                fullName: { type: "string" },
                guardianName: { type: "string" },
                phone: { type: "string" },
                alternatePhone: { type: "string" },
                email: { type: "string" },
                targetExam: { type: "string" },
                city: { type: "string" },
                notes: { type: "string" },
              },
            },
          },
        },
      },
    },
    input: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: JSON.stringify({
          lead: {
            fullName: input.lead.fullName,
            guardianName: input.lead.guardianName,
            phone: input.lead.phone,
            targetExam: input.lead.targetExam,
            city: input.lead.city,
            status: input.lead.status,
            notes: input.lead.notes,
          },
          transcript: input.transcript,
        }),
      },
    ],
  } as unknown as Parameters<typeof openai.responses.create>[0]);

  const outputContainer = response as unknown as {
    output?: Array<{ type: string; json: unknown }>;
  };
  const output = outputContainer.output?.[0];
  if (output?.type === "json") {
    return output.json as {
      message: string;
      expect_response: boolean;
      lead_status: LeadStatus;
      schedule_demo: null | { accepted: boolean; proposed_date?: string; proposed_time?: string; notes?: string };
      summary_note: string;
      updated_lead?: Partial<{
        fullName: string;
        guardianName: string;
        phone: string;
        alternatePhone: string;
        email: string;
        targetExam: string;
        city: string;
        notes: string;
      }>;
    };
  }

  throw new Error("Failed to parse OpenAI response");
};

export const handleCallTurn = async (params: {
  leadId: string;
  twilioSid?: string;
  transcription?: string;
  direction?: CallDirection;
}) => {
  const lead = await prisma.lead.findUnique({ where: { id: params.leadId } });
  if (!lead) {
    throw new Error("Lead not found");
  }

  const callSession = await ensureCallSession(lead.id, {
    direction: params.direction ?? CallDirection.OUTBOUND,
    twilioSid: params.twilioSid,
  });

  const logs = await prisma.callLog.findMany({
    where: { callSessionId: callSession.id },
    orderBy: { createdAt: "asc" },
  });

  const transcript: CallStatePayload["transcript"] = logs.map((log) => ({
    role: log.role === "agent" ? "agent" : "lead",
    content: log.message,
  }));

  if (params.transcription) {
    await prisma.callLog.create({
      data: {
        callSessionId: callSession.id,
        role: "lead",
        message: params.transcription,
      },
    });
    transcript.push({ role: "lead", content: params.transcription });
  }

  let result;
  if (env.OPENAI_API_KEY) {
    try {
      result = await callCompletionWithOpenAI({ leadId: lead.id, callSessionId: callSession.id, transcript });
    } catch (error) {
      console.error("OpenAI call failed", error);
      result = FALLBACK_SCRIPT(transcript, lead.fullName);
    }
  } else {
    result = FALLBACK_SCRIPT(transcript, lead.fullName);
  }

  await prisma.callLog.create({
    data: {
      callSessionId: callSession.id,
      role: "agent",
      message: result.message,
    },
  });

  await prisma.callSession.update({
    where: { id: callSession.id },
    data: {
      status: CallStatus.IN_PROGRESS,
      transcript: [...transcript, { role: "agent", content: result.message }],
      currentGoal: result.summary_note,
    },
  });

  const leadUpdates = result.updated_lead ?? {};
  const dataToUpdate: Record<string, unknown> = {};
  (Object.keys(leadUpdates) as (keyof typeof leadUpdates)[]).forEach((key) => {
    const value = leadUpdates[key];
    if (value) {
      dataToUpdate[key] = value;
    }
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: result.lead_status,
      ...(Object.keys(dataToUpdate).length ? dataToUpdate : {}),
    },
  });

  if (result.schedule_demo?.accepted) {
    const notes = `Demo scheduled for ${result.schedule_demo.proposed_date ?? "TBD"} at ${
      result.schedule_demo.proposed_time ?? "TBD"
    }. ${result.schedule_demo.notes ?? ""}`.trim();
    await prisma.task.create({
      data: {
        leadId: lead.id,
        title: `Demo class - ${lead.fullName ?? lead.phone}`,
        status: TaskStatus.OPEN,
        dueAt:
          result.schedule_demo.proposed_date && result.schedule_demo.proposed_time
            ? new Date(`${result.schedule_demo.proposed_date}T${result.schedule_demo.proposed_time}:00Z`)
            : undefined,
        note: notes,
      },
    });
  }

  return {
    message: result.message,
    expectResponse: result.expect_response,
    callSessionId: callSession.id,
  };
};

export const logLeadUtterance = async (callSessionId: string, message: string) => {
  await prisma.callLog.create({
    data: {
      callSessionId,
      role: "lead",
      message,
    },
  });
};

export const markCallCompleted = async (callSid: string, status: CallStatus) => {
  const session = await prisma.callSession.findFirst({ where: { twilioSid: callSid } });
  if (!session) return;

  await prisma.callSession.update({
    where: { id: session.id },
    data: { status },
  });
};
