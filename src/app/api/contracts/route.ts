import { NextRequest, NextResponse } from "next/server";
import { verifyUserAuthenticated } from "@/lib/supabase/verify_user_server";
import {
  createContractDraft,
  createContractInClm,
  fetchContractsFromClm,
  filterContracts,
  listContracts,
} from "@/lib/contracts/contract-library";
import { ContractDraft, ContractType } from "@opencanvas/shared/types";

export async function GET(req: NextRequest) {
  try {
    const authRes = await verifyUserAuthenticated();
    if (!authRes?.user || !authRes?.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const contracts = await fetchContractsFromClm(req.nextUrl.searchParams);
      if (contracts) {
        return NextResponse.json(
          { contracts, source: "clm", total: contracts.length },
          { status: 200 }
        );
      }
    } catch (error) {
      console.warn("Falling back to mock contracts list", error);
    }

    const contracts = filterContracts(listContracts(), {
      status: req.nextUrl.searchParams.get("status"),
      contractType: req.nextUrl.searchParams.get("contractType"),
      requestId: req.nextUrl.searchParams.get("requestId"),
      threadId: req.nextUrl.searchParams.get("threadId"),
      q: req.nextUrl.searchParams.get("q"),
    });

    return NextResponse.json(
      { contracts, source: "mock", total: contracts.length },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch contracts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authRes = await verifyUserAuthenticated();
    if (!authRes?.user || !authRes?.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      title?: string;
      requestId?: string;
      threadId?: string;
      draft?: Partial<ContractDraft>;
      contractType?: ContractType;
    };

    if (!body.title || !body.contractType) {
      return NextResponse.json(
        { error: "`title` and `contractType` are required" },
        { status: 400 }
      );
    }

    try {
      const contract = await createContractInClm({
        ...body,
        createdBy: authRes.user.id,
      });
      if (contract) {
        return NextResponse.json({ contract, source: "clm" }, { status: 201 });
      }
    } catch (error) {
      console.warn("Falling back to mock contract creation", error);
    }

    const contract = createContractDraft({
      createdBy: authRes.user.id,
      title: body.title,
      contractType: body.contractType,
      fullMarkdown: body.draft?.fullMarkdown,
      parties: body.draft?.parties,
      selectedClauses: body.draft?.selectedClauses,
      metadata: body.draft?.metadata,
      requestId: body.requestId,
      threadId: body.threadId,
    });

    return NextResponse.json({ contract, source: "mock" }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create contract" },
      { status: 500 }
    );
  }
}
