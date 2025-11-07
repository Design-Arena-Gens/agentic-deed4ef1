import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export const GET = async () => {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      tasks: true,
      calls: true,
    },
  });

  const worksheetData = leads.map((lead) => ({
    Name: lead.fullName ?? "",
    Guardian: lead.guardianName ?? "",
    Phone: lead.phone ?? "",
    AlternatePhone: lead.alternatePhone ?? "",
    Email: lead.email ?? "",
    City: lead.city ?? "",
    Source: lead.source,
    Status: lead.status,
    TargetExam: lead.targetExam ?? "",
    Notes: lead.notes ?? "",
    CreatedAt: lead.createdAt.toISOString(),
    UpdatedAt: lead.updatedAt.toISOString(),
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leads-export-${Date.now()}.xlsx"`,
    },
  });
};
