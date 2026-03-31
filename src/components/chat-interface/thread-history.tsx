import { isToday, isYesterday, isWithinInterval, subDays } from "date-fns";
import { TooltipIconButton } from "../ui/assistant-ui/tooltip-icon-button";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Trash2, Search } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "../ui/sheet";
import { Skeleton } from "../ui/skeleton";
import { useEffect, useState } from "react";
import { Thread } from "@langchain/langgraph-sdk";
import { PiChatsCircleLight } from "react-icons/pi";
import { TighterText } from "../ui/header";
import { useGraphContext } from "@/contexts/GraphContext";
import { useToast } from "@/hooks/use-toast";
import React from "react";
import { useUserContext } from "@/contexts/UserContext";
import { useThreadContext } from "@/contexts/ThreadProvider";
import { FEATURES } from "@/lib/feature-flags";
import { ContractRequest } from "@opencanvas/shared/types";
import {
  hydrateStoredContractClient,
  StoredContractDraftClient,
  StoredContractDraftWireClient,
} from "@/lib/contracts/contract-client";
import {
  ContractRequestWire,
  hydrateRequests,
} from "@/lib/contracts/request-library";
import { ensureRequestDraftThread } from "@/lib/contracts/request-drafting";
import { ensureContractDraftThread } from "@/lib/contracts/contract-threading";
import { ContractCard } from "@/components/contracts-panel/contract-card";
import { ContractFilters } from "@/components/contracts-panel/contract-filters";
import { RequestCard } from "@/components/requests-panel/request-card";
import { RequestFilters } from "@/components/requests-panel/request-filters";
import { RequestsPanelLoadingSkeleton } from "@/components/requests-panel/loading-skeleton";
import { cn } from "@/lib/utils";

interface ThreadHistoryProps {
  switchSelectedThreadCallback: (thread: Thread) => void;
}

interface ThreadProps {
  id: string;
  onClick: () => void;
  onDelete: () => void;
  label: string;
  subtitle?: string;
  badges: Array<{
    label: string;
    className?: string;
  }>;
  createdAt: Date;
}

const ThreadItem = (props: ThreadProps) => {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div
      className="flex flex-row gap-0 items-center justify-start w-full"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <Button
        className="h-auto min-w-[191px] flex-grow items-start justify-start px-2 py-2 pr-0"
        size="sm"
        variant="ghost"
        onClick={props.onClick}
      >
        <div className="flex w-full flex-col items-start gap-1">
          <TighterText className="w-full truncate text-left text-sm font-light">
            {props.label}
          </TighterText>
          {props.subtitle && (
            <p className="w-full truncate text-left text-[11px] text-gray-500">
              {props.subtitle}
            </p>
          )}
          {!!props.badges.length && (
            <div className="flex flex-wrap gap-1">
              {props.badges.map((badge) => (
                <Badge
                  key={`${props.id}-${badge.label}`}
                  variant="outline"
                  className={badge.className ?? "bg-slate-50 text-slate-700"}
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Button>
      {isHovering && (
        <TooltipIconButton
          tooltip="Delete thread"
          variant="ghost"
          onClick={props.onDelete}
        >
          <Trash2 className="w-12 h-12 text-[#575757] hover:text-red-500 transition-colors ease-in" />
        </TooltipIconButton>
      )}
    </div>
  );
};

const LoadingThread = () => <Skeleton className="w-full h-8" />;

const formatMetadataValue = (value: string) => value.replaceAll("_", " ");

const getStatusBadgeClassName = (status: string) => {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "in_progress":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "review":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "bg-slate-50 text-slate-700";
  }
};

const convertThreadActualToThreadProps = (
  thread: Thread,
  switchSelectedThreadCallback: (thread: Thread) => void,
  deleteThread: (id: string) => void
): ThreadProps => {
  const supplierName =
    typeof thread.metadata?.supplier_name === "string"
      ? thread.metadata.supplier_name
      : null;
  const requestId =
    typeof thread.metadata?.request_id === "string"
      ? thread.metadata.request_id
      : null;
  const contractId =
    typeof thread.metadata?.contract_id === "string"
      ? thread.metadata.contract_id
      : null;
  const requestStatus =
    typeof thread.metadata?.request_status === "string"
      ? thread.metadata.request_status
      : null;
  const contractType =
    typeof thread.metadata?.contract_type === "string"
      ? thread.metadata.contract_type
      : null;

  const label =
    supplierName ??
    thread.metadata?.thread_title ??
    ((thread.values as Record<string, any>)?.messages?.[0]?.content ||
      "Untitled");

  const subtitle = [contractType ? formatMetadataValue(contractType) : null, requestId]
    .filter(Boolean)
    .join(" · ");

  const badges: ThreadProps["badges"] = [];
  if (thread.metadata?.source === "contract_request") {
    badges.push({
      label: "Draft",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    });
  }
  if (requestStatus) {
    badges.push({
      label: formatMetadataValue(requestStatus),
      className: getStatusBadgeClassName(requestStatus),
    });
  }
  if (contractId) {
    badges.push({
      label: contractId,
      className: "border-slate-200 bg-slate-50 text-slate-700",
    });
  }

  return {
    id: thread.thread_id,
    label,
    subtitle: subtitle || undefined,
    badges,
    createdAt: new Date(thread.created_at),
    onClick: () => {
      return switchSelectedThreadCallback(thread);
    },
    onDelete: () => {
      return deleteThread(thread.thread_id);
    },
  };
};

const groupThreads = (
  threads: Thread[],
  switchSelectedThreadCallback: (thread: Thread) => void,
  deleteThread: (id: string) => void
) => {
  const today = new Date();
  const yesterday = subDays(today, 1);
  const sevenDaysAgo = subDays(today, 7);

  return {
    today: threads
      .filter((thread) => isToday(new Date(thread.created_at)))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .map((t) =>
        convertThreadActualToThreadProps(
          t,
          switchSelectedThreadCallback,
          deleteThread
        )
      ),
    yesterday: threads
      .filter((thread) => isYesterday(new Date(thread.created_at)))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .map((t) =>
        convertThreadActualToThreadProps(
          t,
          switchSelectedThreadCallback,
          deleteThread
        )
      ),
    lastSevenDays: threads
      .filter((thread) =>
        isWithinInterval(new Date(thread.created_at), {
          start: sevenDaysAgo,
          end: yesterday,
        })
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .map((t) =>
        convertThreadActualToThreadProps(
          t,
          switchSelectedThreadCallback,
          deleteThread
        )
      ),
    older: threads
      .filter((thread) => new Date(thread.created_at) < sevenDaysAgo)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .map((t) =>
        convertThreadActualToThreadProps(
          t,
          switchSelectedThreadCallback,
          deleteThread
        )
      ),
  };
};

const prettifyDateLabel = (group: string): string => {
  switch (group) {
    case "today":
      return "Today";
    case "yesterday":
      return "Yesterday";
    case "lastSevenDays":
      return "Last 7 days";
    case "older":
      return "Older";
    default:
      return group;
  }
};

interface ThreadsListProps {
  groupedThreads: {
    today: ThreadProps[];
    yesterday: ThreadProps[];
    lastSevenDays: ThreadProps[];
    older: ThreadProps[];
  };
}

interface RequestsResponse {
  requests: ContractRequestWire[];
  source: "clm" | "mock";
  total: number;
}

interface ContractsResponse {
  contracts: StoredContractDraftWireClient[];
  source: "clm" | "mock";
  total: number;
}

function ThreadsList(props: ThreadsListProps) {
  return (
    <div className="flex flex-col pt-3 gap-4">
      {Object.entries(props.groupedThreads).map(([group, threads]) =>
        threads.length > 0 ? (
          <div key={group}>
            <TighterText className="text-sm font-medium mb-1 pl-2">
              {prettifyDateLabel(group)}
            </TighterText>
            <div className="flex flex-col gap-1">
              {threads.map((thread) => (
                <ThreadItem key={thread.id} {...thread} />
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}

export function ThreadHistoryComponent(props: ThreadHistoryProps) {
  const { toast } = useToast();
  const {
    graphData: { setMessages, switchSelectedThread },
  } = useGraphContext();
  const {
    createThread,
    deleteThread,
    getThread,
    getUserThreads,
    updateThreadMetadata,
    userThreads,
    isUserThreadsLoading,
  } = useThreadContext();
  const { user } = useUserContext();
  const [open, setOpen] = useState(false);
  const [activeView, setActiveView] = useState<
    "threads" | "requests" | "contracts"
  >("threads");
  const [requests, setRequests] = useState<ContractRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState("all");
  const [contracts, setContracts] = useState<StoredContractDraftClient[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractSearch, setContractSearch] = useState("");
  const [contractStatusFilter, setContractStatusFilter] = useState("all");
  const hasUserThreads = userThreads.length > 0;

  useEffect(() => {
    if (typeof window === "undefined" || hasUserThreads || !user) return;

    void getUserThreads();
  }, [getUserThreads, hasUserThreads, user]);

  useEffect(() => {
    if (!FEATURES.REQUESTS_PANEL || !open || activeView !== "requests") {
      return;
    }

    const controller = new AbortController();

    const loadRequests = async () => {
      setRequestsLoading(true);
      try {
        const searchParams = new URLSearchParams();
        if (requestStatusFilter !== "all") {
          searchParams.set("status", requestStatusFilter);
        }
        if (requestSearch.trim()) {
          searchParams.set("q", requestSearch.trim());
        }

        const response = await fetch(`/api/requests?${searchParams.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as RequestsResponse;
        setRequests(hydrateRequests(payload.requests ?? []));
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("Failed to load requests for history", error);
        }
      } finally {
        setRequestsLoading(false);
      }
    };

    void loadRequests();

    return () => controller.abort();
  }, [activeView, open, requestSearch, requestStatusFilter]);

  useEffect(() => {
    if (!open || activeView !== "contracts") {
      return;
    }

    const controller = new AbortController();

    const loadContracts = async () => {
      setContractsLoading(true);
      try {
        const searchParams = new URLSearchParams();
        if (contractStatusFilter !== "all") {
          searchParams.set("status", contractStatusFilter);
        }
        if (contractSearch.trim()) {
          searchParams.set("q", contractSearch.trim());
        }

        const response = await fetch(`/api/contracts?${searchParams.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as ContractsResponse;
        setContracts(
          (payload.contracts ?? []).map(hydrateStoredContractClient)
        );
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("Failed to load contracts for history", error);
        }
      } finally {
        setContractsLoading(false);
      }
    };

    void loadContracts();

    return () => controller.abort();
  }, [activeView, open, contractSearch, contractStatusFilter]);

  const handleDeleteThread = async (id: string) => {
    if (!user) {
      toast({
        title: "Failed to delete thread",
        description: "User not found",
        duration: 5000,
        variant: "destructive",
      });
      return;
    }

    await deleteThread(id, () => setMessages([]));
  };

  const handleStartRequestThread = async (request: ContractRequest) => {
    try {
      const { thread, reusedThread } = await ensureRequestDraftThread({
        request,
        userThreads,
        createThread,
        updateThreadMetadata,
      });

      switchSelectedThread(thread);
      props.switchSelectedThreadCallback(thread);
      setOpen(false);
      toast({
        title: reusedThread
          ? "Request draft reopened"
          : "Request moved into drafting",
        description: reusedThread
          ? `${request.id} already had a dedicated draft thread.`
          : `${request.id} is now open as its own conversation thread.`,
        duration: 4000,
      });
    } catch (error) {
      console.error("Failed to create request thread", error);
      toast({
        title: "Failed to create request thread",
        description: `Could not open ${request.id} from the queue.`,
        duration: 4000,
        variant: "destructive",
      });
    }
  };

  const handleOpenContractThread = async (contract: StoredContractDraftClient) => {
    try {
      const { thread, reusedThread } = await ensureContractDraftThread({
        contract,
        userThreads,
        getThread,
        createThread,
        updateThreadMetadata,
      });

      switchSelectedThread(thread);
      props.switchSelectedThreadCallback(thread);
      setOpen(false);
      toast({
        title: reusedThread ? "Contract draft reopened" : "Contract opened in drafting",
        description: reusedThread
          ? `${contract.id} reopened in its linked drafting thread.`
          : `${contract.id} is now open in a dedicated drafting thread.`,
        duration: 4000,
      });
    } catch (error) {
      console.error("Failed to open contract thread", error);
      toast({
        title: "Failed to open contract",
        description: `Could not open ${contract.id} in drafting.`,
        duration: 4000,
        variant: "destructive",
      });
    }
  };

  const groupedThreads = groupThreads(
    userThreads,
    (thread) => {
      switchSelectedThread(thread);
      props.switchSelectedThreadCallback(thread);
      setOpen(false);
    },
    handleDeleteThread
  );

  const requestCounts = requests.reduce<Record<string, number>>((acc, request) => {
    acc[request.status] = (acc[request.status] ?? 0) + 1;
    return acc;
  }, {});

  const contractCounts = contracts.reduce<Record<string, number>>((acc, contract) => {
    const status = contract.draft.metadata.status;
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  const requestDraftIds = new Set(
    userThreads.flatMap((thread) =>
      typeof thread.metadata?.request_id === "string"
        ? [thread.metadata.request_id]
        : []
    )
  );

  const contractDraftIds = new Set(
    userThreads.flatMap((thread) =>
      typeof thread.metadata?.contract_id === "string"
        ? [thread.metadata.contract_id]
        : []
    )
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <TooltipIconButton
          tooltip="History"
          variant="ghost"
          className="w-fit h-fit p-2"
        >
          <PiChatsCircleLight
            className="w-6 h-6 text-gray-600"
            strokeWidth={8}
          />
        </TooltipIconButton>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="border-none overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
        aria-describedby={undefined}
      >
        <SheetTitle>
          <TighterText className="px-2 text-lg text-gray-600">
            Workspace
          </TighterText>
        </SheetTitle>

        <div
          className={cn(
            "grid gap-2 px-2 pt-4",
            FEATURES.REQUESTS_PANEL ? "grid-cols-3" : "grid-cols-2"
          )}
        >
          <Button
            type="button"
            size="sm"
            variant={activeView === "threads" ? "default" : "outline"}
            onClick={() => setActiveView("threads")}
          >
            Conversations
          </Button>
          {FEATURES.REQUESTS_PANEL && (
            <Button
              type="button"
              size="sm"
              variant={activeView === "requests" ? "default" : "outline"}
              onClick={() => setActiveView("requests")}
            >
              Requests
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={activeView === "contracts" ? "default" : "outline"}
            onClick={() => setActiveView("contracts")}
          >
            Contracts
          </Button>
        </div>

        {activeView === "requests" && FEATURES.REQUESTS_PANEL ? (
          <div className="px-2 pt-4">
            <p className="mb-4 text-sm text-gray-500">
              Select a request to create a dedicated draft thread with the brief
              already loaded.
            </p>
            <RequestFilters
              counts={requestCounts}
              total={requests.length}
              value={requestStatusFilter}
              onChange={setRequestStatusFilter}
            />
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
              <Search className="size-4 text-gray-400" />
              <Input
                value={requestSearch}
                onChange={(event) => setRequestSearch(event.target.value)}
                placeholder="Search supplier, requester, contract type, or priority"
                className="border-0 p-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="mt-4 space-y-3">
              {requestsLoading ? (
                <RequestsPanelLoadingSkeleton />
              ) : requests.length ? (
                requests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    active={false}
                    hasDraftThread={requestDraftIds.has(request.id)}
                    onSelect={(selected) =>
                      void handleStartRequestThread(selected)
                    }
                  />
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  No requests match the current filters.
                </p>
              )}
            </div>
          </div>
        ) : activeView === "contracts" ? (
          <div className="px-2 pt-4">
            <p className="mb-4 text-sm text-gray-500">
              Open a persisted contract draft and continue drafting in its linked
              thread.
            </p>
            <ContractFilters
              counts={contractCounts}
              total={contracts.length}
              value={contractStatusFilter}
              onChange={setContractStatusFilter}
            />
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
              <Search className="size-4 text-gray-400" />
              <Input
                value={contractSearch}
                onChange={(event) => setContractSearch(event.target.value)}
                placeholder="Search contract title, party, type, ID, or request"
                className="border-0 p-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="mt-4 space-y-3">
              {contractsLoading ? (
                <RequestsPanelLoadingSkeleton />
              ) : contracts.length ? (
                contracts.map((contract) => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    active={false}
                    hasDraftThread={
                      contractDraftIds.has(contract.id) || !!contract.threadId
                    }
                    onSelect={(selected) => void handleOpenContractThread(selected)}
                  />
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  No contracts match the current filters.
                </p>
              )}
            </div>
          </div>
        ) : isUserThreadsLoading && !userThreads.length ? (
          <div className="flex flex-col gap-1 px-2 pt-3">
            {Array.from({ length: 25 }).map((_, i) => (
              <LoadingThread key={`loading-thread-${i}`} />
            ))}
          </div>
        ) : !userThreads.length ? (
          <p className="px-3 pt-4 text-gray-500">No items found in history.</p>
        ) : (
          <ThreadsList groupedThreads={groupedThreads} />
        )}
      </SheetContent>
    </Sheet>
  );
}

export const ThreadHistory = React.memo(ThreadHistoryComponent);
