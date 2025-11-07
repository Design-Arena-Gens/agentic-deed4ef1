import { NextResponse } from "next/server";
import { z } from "zod";
import { LeadSource, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const createLeadSchema = z.object({
  fullName: z.string().optional(),
  guardianName: z.string().optional(),
  phone: z.string().min(8),
  alternatePhone: z.string().optional(),
  email: z.string().email().optional(),
  targetExam: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
  source: z.nativeEnum(LeadSource).default(LeadSource.MANUAL),
});

export const GET = async () => {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      calls: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      tasks: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({ leads });
};

export const POST = async (request: Request) => {
  try {
    const body = await request.json();
    const payload = createLeadSchema.parse(body);
    const normalize = (value?: string | null) => value?.replace(/\D/g, "") ?? undefined;
    const lead = await prisma.lead.create({
      data: {
        ...payload,
        phone: normalize(payload.phone) ?? payload.phone,
        alternatePhone: normalize(payload.alternatePhone) ?? payload.alternatePhone,
        status: LeadStatus.NEW,
      },
    });

    return NextResponse.json({ lead });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
};
