import { NextRequest, NextResponse } from "next/server";
import { verifyUserAuthenticated } from "@/lib/supabase/verify_user_server";
import {
  applyRequestAction,
  getRequestById,
  fetchRequestByIdFromClm,
  postRequestActionToClm,
} from "@/lib/contracts/request-library";

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
      const request = await fetchRequestByIdFromClm(id);
      if (request) {
        return NextResponse.json({ request, source: "clm" }, { status: 200 });
      }
    } catch (error) {
      console.warn("Falling back to mock request detail", error);
    }

    const request = getRequestById(id);
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    return NextResponse.json({ request, source: "mock" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch request" },
      { status: 500 }
    );
  }
}

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
    const body = (await req.json()) as { action?: "accept" | "reject" };

    if (!body.action || !["accept", "reject"].includes(body.action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    try {
      const request = await postRequestActionToClm(id, body.action);
      if (request) {
        return NextResponse.json({ request, source: "clm" }, { status: 200 });
      }
    } catch (error) {
      console.warn("Falling back to mock request action", error);
    }

    const request = getRequestById(id);
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    return NextResponse.json(
      { request: applyRequestAction(request, body.action), source: "mock" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update request" },
      { status: 500 }
    );
  }
}
