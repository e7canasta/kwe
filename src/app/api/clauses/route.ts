import { NextRequest, NextResponse } from "next/server";
import { verifyUserAuthenticated } from "@/lib/supabase/verify_user_server";
import {
  MOCK_CLAUSES,
  fetchClausesFromClm,
  filterClauses,
} from "@/lib/contracts/clause-library";

export async function GET(req: NextRequest) {
  try {
    const authRes = await verifyUserAuthenticated();
    if (!authRes?.user || !authRes?.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const clauses = await fetchClausesFromClm(req.nextUrl.searchParams);
      if (clauses) {
        return NextResponse.json(
          { clauses, source: "clm", total: clauses.length },
          { status: 200 }
        );
      }
    } catch (error) {
      console.warn("Falling back to mock clause library", error);
    }

    const clauses = filterClauses(MOCK_CLAUSES, {
      category: req.nextUrl.searchParams.get("category"),
      q: req.nextUrl.searchParams.get("q"),
    });

    return NextResponse.json(
      { clauses, source: "mock", total: clauses.length },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch clauses" },
      { status: 500 }
    );
  }
}
