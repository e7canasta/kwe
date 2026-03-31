"use client";

import { useMemo, useState } from "react";
import {
  ArtifactMarkdownV3,
  Clause,
  ContractDraft,
  ContractType,
  SelectedClause,
} from "@opencanvas/shared/types";
import { FileDown, LoaderCircle } from "lucide-react";
import { Thread } from "@langchain/langgraph-sdk";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useGraphContext } from "@/contexts/GraphContext";
import { useThreadContext } from "@/contexts/ThreadProvider";
import { useActiveThread } from "@/hooks/useActiveThread";

interface ContractResponse {
  contract?: {
    id: string;
  };
  source?: "mock" | "clm";
  error?: string;
}

interface ContractExportPayload {
  fileName?: string;
  mimeType?: string;
  content?: string;
  downloadUrl?: string;
  url?: string;
  source?: "mock" | "clm";
}

interface ContractExportMenuProps {
  currentArtifactContent: ArtifactMarkdownV3;
}

type DraftPersistencePayload = Partial<Omit<ContractDraft, "metadata">> & {
  metadata: Partial<ContractDraft["metadata"]>;
};

const CONTRACT_TYPES: ContractType[] = [
  "purchase_order",
  "service_agreement",
  "nda",
  "master_agreement",
  "amendment",
  "renewal",
  "other",
];

const triggerDownload = (fileName: string, mimeType: string, content: string) => {
  const blob = new Blob([content], {
    type: mimeType || "text/plain;charset=utf-8",
  });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
};

const resolveContractType = (thread: Thread | null): ContractType => {
  const rawType = thread?.metadata?.contract_type;
  if (typeof rawType === "string" && CONTRACT_TYPES.includes(rawType as ContractType)) {
    return rawType as ContractType;
  }
  return "other";
};

const buildDraftPayload = (
  currentArtifactContent: ArtifactMarkdownV3,
  contractType: ContractType,
  selectedClauses: Clause[]
): DraftPersistencePayload => {
  const normalizedSelectedClauses: SelectedClause[] = selectedClauses.map(
    (clause) => ({
      ...clause,
      filledVariables: {},
      insertedAt: new Date(),
    })
  );

  return {
    title: currentArtifactContent.title,
    fullMarkdown: currentArtifactContent.fullMarkdown,
    metadata: {
      contractType,
    },
    ...(normalizedSelectedClauses.length
      ? { selectedClauses: normalizedSelectedClauses }
      : {}),
  };
};

export function ContractExportMenu(props: ContractExportMenuProps) {
  const { toast } = useToast();
  const activeThread = useActiveThread();
  const { updateThreadMetadata } = useThreadContext();
  const {
    graphData: { selectedClauses },
  } = useGraphContext();
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "docx" | null>(
    null
  );

  const contractId = useMemo(() => {
    const raw = activeThread?.metadata?.contract_id;
    return typeof raw === "string" ? raw : null;
  }, [activeThread]);

  const requestId = useMemo(() => {
    const raw = activeThread?.metadata?.request_id;
    return typeof raw === "string" ? raw : undefined;
  }, [activeThread]);

  const persistCurrentDraft = async () => {
    if (!activeThread) {
      throw new Error("No active thread was found for this draft.");
    }

    const contractType = resolveContractType(activeThread);
    const draft = buildDraftPayload(
      props.currentArtifactContent,
      contractType,
      selectedClauses
    );

    if (contractId) {
      const response = await fetch(`/api/contracts/${encodeURIComponent(contractId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId,
          threadId: activeThread.thread_id,
          draft,
        }),
      });

      const payload = (await response.json()) as ContractResponse;
      if (!response.ok || !payload.contract?.id) {
        throw new Error(
          payload.error ?? `Failed to sync contract ${contractId} before export.`
        );
      }

      return {
        contractId: payload.contract.id,
        created: false,
      };
    }

    const response = await fetch("/api/contracts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: props.currentArtifactContent.title,
        requestId,
        threadId: activeThread.thread_id,
        contractType,
        draft,
      }),
    });

    const payload = (await response.json()) as ContractResponse;
    if (!response.ok || !payload.contract?.id) {
      throw new Error(payload.error ?? "Failed to persist contract before export.");
    }

    await updateThreadMetadata(activeThread.thread_id, {
      contract_id: payload.contract.id,
      contract_type: contractType,
    });

    return {
      contractId: payload.contract.id,
      created: true,
    };
  };

  const handleExport = async (format: "pdf" | "docx") => {
    setExportingFormat(format);

    try {
      const persisted = await persistCurrentDraft();
      const response = await fetch(
        `/api/contracts/${encodeURIComponent(persisted.contractId)}/export`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ format }),
        }
      );

      const payload = (await response.json()) as ContractExportPayload & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? `Export failed with ${response.status}`);
      }

      const downloadUrl =
        typeof payload.downloadUrl === "string"
          ? payload.downloadUrl
          : typeof payload.url === "string"
            ? payload.url
            : null;

      if (downloadUrl) {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
      } else if (typeof payload.content === "string") {
        triggerDownload(
          payload.fileName ?? `${persisted.contractId}.${format}`,
          payload.mimeType ??
            (format === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
          payload.content
        );
      } else {
        throw new Error("Export payload did not include downloadable content.");
      }

      toast({
        title: `Contract exported as ${format.toUpperCase()}`,
        description: persisted.created
          ? "The draft was first persisted and linked to this thread."
          : payload.source === "mock"
            ? "Downloaded the latest mock export payload."
            : "Downloaded the contract export from the backend service.",
        duration: 4000,
      });
    } catch (error) {
      console.error("Failed to export contract", error);
      toast({
        title: "Failed to export contract",
        description:
          error instanceof Error
            ? error.message
            : "The export request did not complete successfully.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={!!exportingFormat || !activeThread}
        >
          {exportingFormat ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <FileDown className="size-4" />
          )}
          {contractId ? "Export" : "Save / Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={!!exportingFormat || !activeThread}
          onClick={() => void handleExport("docx")}
        >
          Export as DOCX
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!!exportingFormat || !activeThread}
          onClick={() => void handleExport("pdf")}
        >
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
