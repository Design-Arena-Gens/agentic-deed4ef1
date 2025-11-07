import { NextResponse } from "next/server";
import { syncLeads } from "@/server/leadSync";

export const revalidate = 0;

export const POST = async () => {
  try {
    const result = await syncLeads();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Lead sync error", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
};
