import { NextResponse } from "next/server";
import { verifyUserAuthenticated } from "@/lib/supabase/verify_user_server";
import {
  CLAUSE_CATEGORIES,
  fetchClauseCategoriesFromClm,
} from "@/lib/contracts/clause-library";

export async function GET() {
  try {
    const authRes = await verifyUserAuthenticated();
    if (!authRes?.user || !authRes?.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const categories = await fetchClauseCategoriesFromClm();
      if (categories?.length) {
        return NextResponse.json(
          { categories, source: "clm" },
          { status: 200 }
        );
      }
    } catch (error) {
      console.warn("Falling back to local clause categories", error);
    }

    return NextResponse.json(
      { categories: CLAUSE_CATEGORIES, source: "mock" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch clause categories" },
      { status: 500 }
    );
  }
}
