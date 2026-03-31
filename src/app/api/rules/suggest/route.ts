import { NextRequest, NextResponse } from "next/server";
import { verifyUserAuthenticated } from "@/lib/supabase/verify_user_server";
import { MOCK_CLAUSES } from "@/lib/contracts/clause-library";
import { suggestClauses } from "@/lib/contracts/draft-tools";
import { Clause } from "@opencanvas/shared/types";

interface SuggestRulesPayload {
  selectedClauseIds?: string[];
  selectedClauses?: Clause[];
}

const rulesHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (process.env.RULES_ENGINE_API_KEY) {
    headers["x-api-key"] = process.env.RULES_ENGINE_API_KEY;
    headers.Authorization = `Bearer ${process.env.RULES_ENGINE_API_KEY}`;
  }

  return headers;
};

const resolveSelectedClauses = (payload: SuggestRulesPayload): Clause[] => {
  if (payload.selectedClauses?.length) {
    return payload.selectedClauses;
  }

  if (!payload.selectedClauseIds?.length) {
    return [];
  }

  return payload.selectedClauseIds
    .map((id) => MOCK_CLAUSES.find((clause) => clause.id === id))
    .filter((clause): clause is Clause => !!clause);
};

export async function POST(req: NextRequest) {
  try {
    const authRes = await verifyUserAuthenticated();
    if (!authRes?.user || !authRes?.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await req.json()) as SuggestRulesPayload;

    if (process.env.RULES_ENGINE_URL) {
      try {
        const response = await fetch(
          new URL("/suggest", process.env.RULES_ENGINE_URL),
          {
            method: "POST",
            headers: rulesHeaders(),
            body: JSON.stringify(payload),
            cache: "no-store",
          }
        );

        if (response.ok) {
          const result = await response.json();
          return NextResponse.json(result, { status: 200 });
        }
      } catch (error) {
        console.warn("Rules engine suggest fallback engaged", error);
      }
    }

    const selectedClauses = resolveSelectedClauses(payload);
    const suggestions = suggestClauses(selectedClauses, MOCK_CLAUSES);

    return NextResponse.json(
      { suggestions, source: process.env.RULES_ENGINE_URL ? "fallback" : "local" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to suggest clauses" },
      { status: 500 }
    );
  }
}
