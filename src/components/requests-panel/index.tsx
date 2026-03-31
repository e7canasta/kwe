"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Search } from "lucide-react";
import { ContractRequest } from "@opencanvas/shared/types";
import { useToast } from "@/hooks/use-toast";
import { useGraphContext } from "@/contexts/GraphContext";
import { useThreadContext } from "@/contexts/ThreadProvider";
import {
  ContractRequestWire,
  hydrateRequest,
  hydrateRequests,
} from "@/lib/contracts/request-library";
import { ensureRequestDraftThread } from "@/lib/contracts/request-drafting";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RequestCard } from "./request-card";
import { RequestDetail } from "./request-detail";
import { RequestFilters } from "./request-filters";
import { RequestsPanelLoadingSkeleton } from "./loading-skeleton";

interface RequestsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RequestsResponse {
  requests: ContractRequestWire[];
  source: "clm" | "mock";
  total: number;
}

export interface RequestDetailResponse {
  request: ContractRequestWire;
  source: "clm" | "mock";
}

export function RequestsPanel({ open, onOpenChange }: RequestsPanelProps) {
  const { toast } = useToast();
  const { createThread, updateThreadMetadata, userThreads } = useThreadContext();
  const {
    graphData: { switchSelectedThread, setChatStarted },
  } = useGraphContext();
  const [requests, setRequests] = useState<ContractRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ContractRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [source, setSource] = useState<"clm" | "mock">("mock");

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();

    const loadRequests = async () => {
      setLoading(true);
      try {
        const searchParams = new URLSearchParams();
        if (statusFilter !== "all") {
          searchParams.set("status", statusFilter);
        }
        if (search.trim()) {
          searchParams.set("q", search.trim());
        }

        const response = await fetch(`/api/requests?${searchParams.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as RequestsResponse;
        const nextRequests = hydrateRequests(payload.requests ?? []);

        setRequests(nextRequests);
        setSource(payload.source ?? "mock");
        setSelectedRequestId((current) => {
          if (current && nextRequests.some((request) => request.id === current)) {
            return current;
          }
          return nextRequests[0]?.id ?? null;
        });
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("Failed to load requests", error);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadRequests();

    return () => controller.abort();
  }, [open, search, statusFilter]);

  useEffect(() => {
    if (!open || !selectedRequestId) {
      setSelectedRequest(null);
      return;
    }

    const controller = new AbortController();

    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const response = await fetch(`/api/requests/${selectedRequestId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as RequestDetailResponse;
        setSelectedRequest(hydrateRequest(payload.request));
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("Failed to load request detail", error);
        }
      } finally {
        setDetailLoading(false);
      }
    };

    void loadDetail();

    return () => controller.abort();
  }, [open, selectedRequestId]);

  const startDraftFromRequest = async (request: ContractRequest) => {
    try {
      const { thread, reusedThread } = await ensureRequestDraftThread({
        request,
        userThreads,
        createThread,
        updateThreadMetadata,
      });

      switchSelectedThread(thread);
      setChatStarted(true);
      onOpenChange(false);
      toast({
        title: reusedThread
          ? "Request draft reopened"
          : "Request opened in a new thread",
        description: reusedThread
          ? `${request.id} already had a draft thread and contract.`
          : `${request.id} is now seeded as a dedicated contract draft.`,
        duration: 4000,
      });
    } catch (error) {
      console.error("Failed to open request draft", error);
      toast({
        title: "Failed to create request draft",
        description: `Could not open ${request.id} in a new thread.`,
        duration: 4000,
        variant: "destructive",
      });
    }
  };

  const handleAction = async (request: ContractRequest, action: "accept" | "reject") => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/requests/${request.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as RequestDetailResponse;
      const updatedRequest = hydrateRequest(payload.request);

      setRequests((previous) =>
        previous.map((item) => (item.id === updatedRequest.id ? updatedRequest : item))
      );
      setSelectedRequest(updatedRequest);

      const linkedDraft = requestDraftsById[updatedRequest.id];
      if (linkedDraft) {
        try {
          await updateThreadMetadata(linkedDraft.threadId, {
            request_status: updatedRequest.status,
          });
        } catch (error) {
          console.error("Failed to sync request status into thread metadata", error);
        }
      }

      toast({
        title: action === "accept" ? "Request accepted" : "Request rejected",
        description: `${updatedRequest.id} is now ${updatedRequest.status.replaceAll("_", " ")}.`,
        duration: 4000,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const counts = useMemo(() => {
    return requests.reduce<Record<string, number>>((acc, request) => {
      acc[request.status] = (acc[request.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [requests]);

  const requestDraftsById = useMemo(() => {
    return userThreads.reduce<
      Record<string, { threadId: string; contractId?: string }>
    >((acc, thread) => {
      const requestId =
        typeof thread.metadata?.request_id === "string"
          ? thread.metadata.request_id
          : null;

      if (!requestId || acc[requestId]) {
        return acc;
      }

      const contractId =
        typeof thread.metadata?.contract_id === "string"
          ? thread.metadata.contract_id
          : undefined;

      acc[requestId] = {
        threadId: thread.thread_id,
        contractId,
      };
      return acc;
    }, {});
  }, [userThreads]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-5xl">
        <SheetHeader className="mb-5 pr-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <SheetTitle>Contract Requests</SheetTitle>
              <SheetDescription>
                Intake queue for pending CLM work items and draft starts.
              </SheetDescription>
            </div>
            <Badge variant="outline" className="ml-auto">
              {source.toUpperCase()}
            </Badge>
          </div>
        </SheetHeader>

        <div className="mb-4">
          <RequestFilters
            counts={counts}
            total={requests.length}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
          <Search className="size-4 text-gray-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search supplier, requester, contract type, or priority"
            className="border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="grid h-[calc(100vh-220px)] grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="overflow-y-auto pr-2">
            {loading ? (
              <RequestsPanelLoadingSkeleton />
            ) : requests.length ? (
              <div className="space-y-3">
                {requests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    active={selectedRequestId === request.id}
                    hasDraftThread={!!requestDraftsById[request.id]}
                    onSelect={(selected) => setSelectedRequestId(selected.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-sm text-gray-500">
                No requests match the current filters.
              </div>
            )}
          </div>

          <div className="overflow-y-auto pr-2">
            {detailLoading ? (
              <RequestsPanelLoadingSkeleton />
            ) : (
                <RequestDetail
                  request={selectedRequest}
                  actionLoading={actionLoading}
                  existingDraft={
                    selectedRequest ? requestDraftsById[selectedRequest.id] : null
                  }
                  onAccept={(request) => handleAction(request, "accept")}
                  onReject={(request) => handleAction(request, "reject")}
                  onStartDraft={startDraftFromRequest}
                />
              )}
            </div>
          </div>
      </SheetContent>
    </Sheet>
  );
}
