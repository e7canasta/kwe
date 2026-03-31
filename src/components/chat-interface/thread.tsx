import { useGraphContext } from "@/contexts/GraphContext";
import { useToast } from "@/hooks/use-toast";
import { ThreadPrimitive } from "@assistant-ui/react";
import { Thread as ThreadType } from "@langchain/langgraph-sdk";
import { Badge } from "../ui/badge";
import {
  ArrowDownIcon,
  ClipboardList,
  PanelRightOpen,
  SquarePen,
} from "lucide-react";
import { Dispatch, FC, SetStateAction, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useLangSmithLinkToolUI } from "../tool-hooks/LangSmithLinkToolUI";
import { TooltipIconButton } from "../ui/assistant-ui/tooltip-icon-button";
import { TighterText } from "../ui/header";
import { Composer } from "./composer";
import { AssistantMessage, UserMessage } from "./messages";
import ModelSelector from "./model-selector";
import { ThreadHistory } from "./thread-history";
import { ThreadWelcome } from "./welcome";
import { useUserContext } from "@/contexts/UserContext";
import { useThreadContext } from "@/contexts/ThreadProvider";
import { FEATURES } from "@/lib/feature-flags";
import { useActiveThread } from "@/hooks/useActiveThread";

const RequestsPanel = dynamic(
  () => import("@/components/requests-panel").then((mod) => mod.RequestsPanel),
  { ssr: false }
);

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="absolute -top-8 rounded-full disabled:invisible"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

export interface ThreadProps {
  userId: string | undefined;
  hasChatStarted: boolean;
  handleQuickStart: (type: "text") => void;
  setChatStarted: Dispatch<SetStateAction<boolean>>;
  switchSelectedThreadCallback: (thread: ThreadType) => void;
  setChatCollapsed: (c: boolean) => void;
}

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

export const Thread: FC<ThreadProps> = (props: ThreadProps) => {
  const {
    setChatStarted,
    hasChatStarted,
    handleQuickStart,
    switchSelectedThreadCallback,
  } = props;
  const { toast } = useToast();
  const [requestsPanelOpen, setRequestsPanelOpen] = useState(false);
  const {
    graphData: { clearState, runId, feedbackSubmitted, setFeedbackSubmitted },
  } = useGraphContext();
  const {
    modelName,
    setModelName,
    modelConfig,
    setModelConfig,
    modelConfigs,
    setThreadId,
  } = useThreadContext();
  const { user } = useUserContext();
  const currentThread = useActiveThread();

  const activeThreadSummary = useMemo(() => {
    if (!currentThread) {
      return null;
    }

    const supplierName =
      typeof currentThread.metadata?.supplier_name === "string"
        ? currentThread.metadata.supplier_name
        : null;
    const requestId =
      typeof currentThread.metadata?.request_id === "string"
        ? currentThread.metadata.request_id
        : null;
    const contractId =
      typeof currentThread.metadata?.contract_id === "string"
        ? currentThread.metadata.contract_id
        : null;
    const requestStatus =
      typeof currentThread.metadata?.request_status === "string"
        ? currentThread.metadata.request_status
        : null;
    const contractType =
      typeof currentThread.metadata?.contract_type === "string"
        ? currentThread.metadata.contract_type
        : null;

    if (!supplierName && !requestId && !contractId && !contractType) {
      return null;
    }

    const title =
      supplierName ||
      (typeof currentThread.metadata?.thread_title === "string"
        ? currentThread.metadata.thread_title
        : "Active draft");

    const subtitle = contractType ? formatMetadataValue(contractType) : null;
    const badges: Array<{ label: string; className: string }> = [];

    if (currentThread.metadata?.source === "contract_request") {
      badges.push({
        label: "Draft",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      });
    }
    if (requestId) {
      badges.push({
        label: requestId,
        className: "border-slate-200 bg-slate-50 text-slate-700",
      });
    }
    if (contractId) {
      badges.push({
        label: contractId,
        className: "border-slate-200 bg-slate-50 text-slate-700",
      });
    }
    if (requestStatus) {
      badges.push({
        label: formatMetadataValue(requestStatus),
        className: getStatusBadgeClassName(requestStatus),
      });
    }

    return {
      title,
      subtitle,
      badges,
    };
  }, [currentThread]);

  // Render the LangSmith trace link
  useLangSmithLinkToolUI();

  const handleNewSession = async () => {
    if (!user) {
      toast({
        title: "User not found",
        description: "Failed to create thread without user",
        duration: 5000,
        variant: "destructive",
      });
      return;
    }

    // Remove the threadId param from the URL
    setThreadId(null);

    setModelName(modelName);
    setModelConfig(modelName, modelConfig);
    clearState();
    setChatStarted(false);
  };

  return (
    <ThreadPrimitive.Root className="flex flex-col h-full w-full">
      <div className="pr-3 pl-6 pt-3 pb-2 flex flex-row gap-4 items-center justify-between">
        <div className="flex items-center justify-start gap-2 text-gray-600">
          <ThreadHistory
            switchSelectedThreadCallback={switchSelectedThreadCallback}
          />
          <div className="flex flex-col items-start gap-1">
            <TighterText className="text-xl">Contract Drafter</TighterText>
            {hasChatStarted && activeThreadSummary && (
              <div className="flex flex-col items-start gap-1">
                <p className="text-sm font-medium text-slate-700">
                  {activeThreadSummary.title}
                  {activeThreadSummary.subtitle
                    ? ` · ${activeThreadSummary.subtitle}`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-1">
                  {activeThreadSummary.badges.map((badge) => (
                    <Badge
                      key={`${badge.label}-${badge.className}`}
                      variant="outline"
                      className={badge.className}
                    >
                      {badge.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          {!hasChatStarted && (
            <ModelSelector
              modelName={modelName}
              setModelName={setModelName}
              modelConfig={modelConfig}
              setModelConfig={setModelConfig}
              modelConfigs={modelConfigs}
            />
          )}
        </div>
        {hasChatStarted ? (
          <div className="flex flex-row flex-1 gap-2 items-center justify-end">
            {FEATURES.REQUESTS_PANEL && (
              <TooltipIconButton
                tooltip="Contract requests"
                variant="ghost"
                className="w-8 h-8"
                delayDuration={400}
                onClick={() => setRequestsPanelOpen(true)}
              >
                <ClipboardList className="text-gray-600" />
              </TooltipIconButton>
            )}
            <TooltipIconButton
              tooltip="Collapse Chat"
              variant="ghost"
              className="w-8 h-8"
              delayDuration={400}
              onClick={() => props.setChatCollapsed(true)}
            >
              <PanelRightOpen className="text-gray-600" />
            </TooltipIconButton>
            <TooltipIconButton
              tooltip="New chat"
              variant="ghost"
              className="w-8 h-8"
              delayDuration={400}
              onClick={handleNewSession}
            >
              <SquarePen className="text-gray-600" />
            </TooltipIconButton>
          </div>
        ) : (
          <div className="flex flex-row gap-2 items-center">
            {FEATURES.REQUESTS_PANEL && (
              <TooltipIconButton
                tooltip="Contract requests"
                variant="ghost"
                className="w-8 h-8"
                delayDuration={400}
                onClick={() => setRequestsPanelOpen(true)}
              >
                <ClipboardList className="text-gray-600" />
              </TooltipIconButton>
            )}
          </div>
        )}
      </div>
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto scroll-smooth bg-inherit px-4 pt-8">
        {!hasChatStarted && (
          <ThreadWelcome
            handleQuickStart={handleQuickStart}
            composer={
              <Composer chatStarted={false} userId={props.userId} />
            }
          />
        )}
        <ThreadPrimitive.Messages
          components={{
            UserMessage: UserMessage,
            AssistantMessage: (prop) => (
              <AssistantMessage
                {...prop}
                feedbackSubmitted={feedbackSubmitted}
                setFeedbackSubmitted={setFeedbackSubmitted}
                runId={runId}
              />
            ),
          }}
        />
      </ThreadPrimitive.Viewport>
      <div className="mt-4 flex w-full flex-col items-center justify-end rounded-t-lg bg-inherit pb-4 px-4">
        <ThreadScrollToBottom />
        <div className="w-full max-w-2xl">
          {hasChatStarted && (
            <div className="flex flex-col space-y-2">
              <ModelSelector
                modelName={modelName}
                setModelName={setModelName}
                modelConfig={modelConfig}
                setModelConfig={setModelConfig}
                modelConfigs={modelConfigs}
              />
              <Composer
                chatStarted={true}
                userId={props.userId}
              />
            </div>
          )}
        </div>
      </div>
      {FEATURES.REQUESTS_PANEL && (
        <RequestsPanel
          open={requestsPanelOpen}
          onOpenChange={setRequestsPanelOpen}
        />
      )}
    </ThreadPrimitive.Root>
  );
};
