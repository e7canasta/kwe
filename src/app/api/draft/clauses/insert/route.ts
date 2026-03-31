import { NextRequest, NextResponse } from "next/server";
import { ArtifactV3 } from "@opencanvas/shared/types";
import { verifyUserAuthenticated } from "@/lib/supabase/verify_user_server";
import { isLocalUIModeEnabled } from "@/lib/mock/local-ui";
import { LANGGRAPH_API_URL } from "@/constants";

interface InsertClausesPayload {
  threadId?: string | null;
  artifact?: ArtifactV3;
  selectedClauseIds?: string[];
  insertClauseAtPosition?: number;
}

const getUpstreamUrl = () => {
  const configuredPath = process.env.LANGGRAPH_INSERT_CLAUSE_PATH;
  if (!configuredPath) {
    return null;
  }

  if (/^https?:\/\//.test(configuredPath)) {
    return configuredPath;
  }

  return new URL(configuredPath.replace(/^\/+/, ""), `${LANGGRAPH_API_URL}/`).toString();
};

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as InsertClausesPayload;

    if (!payload.selectedClauseIds?.length) {
      return NextResponse.json(
        { error: "`selectedClauseIds` is required." },
        { status: 400 }
      );
    }

    if (isLocalUIModeEnabled()) {
      return NextResponse.json(
        {
          error: "LangGraph clause insertion is not available in local UI mode.",
          fallback: "local",
        },
        { status: 501 }
      );
    }

    const authRes = await verifyUserAuthenticated();
    if (!authRes?.user || !authRes?.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const upstreamUrl = getUpstreamUrl();
    if (!upstreamUrl) {
      return NextResponse.json(
        {
          error:
            "LangGraph clause insertion is not configured. Set LANGGRAPH_INSERT_CLAUSE_PATH to enable it.",
          fallback: "local",
        },
        { status: 501 }
      );
    }

    const response = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.LANGCHAIN_API_KEY || "",
      },
      body: JSON.stringify({
        ...payload,
        config: {
          configurable: {
            supabase_session: authRes.session,
            supabase_user_id: authRes.user.id,
          },
        },
      }),
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : { error: await response.text() };

    return NextResponse.json(
      {
        ...body,
        source: "langgraph",
      },
      { status: response.status }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? "Failed to insert clauses via LangGraph",
        fallback: "local",
      },
      { status: 502 }
    );
  }
}
