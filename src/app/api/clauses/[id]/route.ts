import { NextRequest, NextResponse } from "next/server";
import { verifyUserAuthenticated } from "@/lib/supabase/verify_user_server";
import {
  fetchClauseByIdFromClm,
  getClauseById,
} from "@/lib/contracts/clause-library";

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
      const clause = await fetchClauseByIdFromClm(id);
      if (clause) {
        return NextResponse.json({ clause, source: "clm" }, { status: 200 });
      }
    } catch (error) {
      console.warn("Falling back to mock clause detail", error);
    }

    const clause = getClauseById(id);
    if (!clause) {
      return NextResponse.json({ error: "Clause not found" }, { status: 404 });
    }

    return NextResponse.json({ clause, source: "mock" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch clause" },
      { status: 500 }
    );
  }
}
