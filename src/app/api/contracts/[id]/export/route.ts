import { NextRequest, NextResponse } from "next/server";
import { verifyUserAuthenticated } from "@/lib/supabase/verify_user_server";
import {
  exportContractDraft,
  exportContractFromClm,
  getContractById,
} from "@/lib/contracts/contract-library";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authRes = await verifyUserAuthenticated();
    if (!authRes?.user || !authRes?.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = decodeURIComponent(params.id);
    const body = (await req.json().catch(() => ({}))) as {
      format?: "pdf" | "docx";
    };
    const format = body.format === "pdf" ? "pdf" : "docx";

    try {
      const exportPayload = await exportContractFromClm(id, format);
      if (exportPayload) {
        return NextResponse.json(
          { ...exportPayload, source: "clm" },
          { status: 200 }
        );
      }
    } catch (error) {
      console.warn("Falling back to mock contract export", error);
    }

    const contract = getContractById(id);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    return NextResponse.json(
      { ...exportContractDraft(contract, format), source: "mock" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to export contract" },
      { status: 500 }
    );
  }
}
