import { NextRequest, NextResponse } from "next/server";
import { verifyUserAuthenticated } from "@/lib/supabase/verify_user_server";
import {
  MOCK_REQUESTS,
  fetchRequestsFromClm,
  filterRequests,
} from "@/lib/contracts/request-library";

export async function GET(req: NextRequest) {
  try {
    const authRes = await verifyUserAuthenticated();
    if (!authRes?.user || !authRes?.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const requests = await fetchRequestsFromClm(req.nextUrl.searchParams);
      if (requests) {
        return NextResponse.json(
          { requests, source: "clm", total: requests.length },
          { status: 200 }
        );
      }
    } catch (error) {
      console.warn("Falling back to mock request list", error);
    }

    const requests = filterRequests(MOCK_REQUESTS, {
      status: req.nextUrl.searchParams.get("status"),
      q: req.nextUrl.searchParams.get("q"),
    });

    return NextResponse.json(
      { requests, source: "mock", total: requests.length },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch requests" },
      { status: 500 }
    );
  }
}
