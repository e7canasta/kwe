import { NextRequest, NextResponse } from "next/server";
import { verifyUserAuthenticated } from "@/lib/supabase/verify_user_server";
import {
  deleteContractDraft,
  deleteContractInClm,
  fetchContractByIdFromClm,
  getContractById,
  updateContractDraft,
  updateContractInClm,
} from "@/lib/contracts/contract-library";
import { ContractDraft } from "@opencanvas/shared/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authRes = await verifyUserAuthenticated();
    if (!authRes?.user || !authRes?.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = decodeURIComponent(params.id);

    try {
      const contract = await fetchContractByIdFromClm(id);
      if (contract) {
        return NextResponse.json({ contract, source: "clm" }, { status: 200 });
      }
    } catch (error) {
      console.warn("Falling back to mock contract detail", error);
    }

    const contract = getContractById(id);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    return NextResponse.json({ contract, source: "mock" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch contract" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authRes = await verifyUserAuthenticated();
    if (!authRes?.user || !authRes?.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = decodeURIComponent(params.id);
    const body = (await req.json()) as {
      requestId?: string;
      threadId?: string;
      draft?: Partial<ContractDraft>;
    };

    try {
      const contract = await updateContractInClm(id, body as Record<string, unknown>);
      if (contract) {
        return NextResponse.json({ contract, source: "clm" }, { status: 200 });
      }
    } catch (error) {
      console.warn("Falling back to mock contract update", error);
    }

    const contract = updateContractDraft(id, body);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    return NextResponse.json({ contract, source: "mock" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update contract" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authRes = await verifyUserAuthenticated();
    if (!authRes?.user || !authRes?.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = decodeURIComponent(params.id);

    try {
      const deleted = await deleteContractInClm(id);
      if (deleted) {
        return NextResponse.json({ ok: true, source: "clm" }, { status: 200 });
      }
    } catch (error) {
      console.warn("Falling back to mock contract deletion", error);
    }

    const contract = deleteContractDraft(id);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    return NextResponse.json(
      { ok: true, contractId: contract.id, source: "mock" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to delete contract" },
      { status: 500 }
    );
  }
}
