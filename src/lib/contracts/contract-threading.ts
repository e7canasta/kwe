"use client";

import { Thread } from "@langchain/langgraph-sdk";
import { CreateThreadOptions } from "@/contexts/ThreadProvider";
import { StoredContractDraftClient } from "./contract-client";

const formatContractTypeLabel = (value: string) => value.replaceAll("_", " ");

const getSupplierName = (contract: StoredContractDraftClient) => {
  return (
    contract.draft.parties.find((party) => party.role === "supplier")?.name ??
    contract.draft.parties[0]?.name ??
    contract.draft.title
  );
};

export function buildContractThreadSeed(contract: StoredContractDraftClient): {
  title: string;
  metadata: Record<string, unknown>;
  values: Record<string, unknown>;
} {
  const supplierName = getSupplierName(contract);
  const contractTypeLabel = formatContractTypeLabel(
    contract.draft.metadata.contractType
  );

  return {
    title: contract.draft.title,
    metadata: {
      thread_title: contract.draft.title,
      source: contract.requestId ? "contract_request" : "contract_draft",
      contract_id: contract.id,
      contract_type: contract.draft.metadata.contractType,
      supplier_name: supplierName,
      ...(contract.requestId ? { request_id: contract.requestId } : {}),
    },
    values: {
      artifact: {
        currentIndex: contract.draft.index,
        contents: [contract.draft],
      },
      messages: [
        {
          id: `contract-human-${contract.id}`,
          type: "human",
          content: `Resume contract draft ${contract.id}.`,
        },
        {
          id: `contract-ai-${contract.id}`,
          type: "ai",
          content: `Contract ${contract.id} loaded for ${supplierName} (${contractTypeLabel}).`,
        },
      ],
    },
  };
}

async function updateContractThreadLink(
  contractId: string,
  payload: { requestId?: string; threadId: string }
) {
  const response = await fetch(`/api/contracts/${encodeURIComponent(contractId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(
      body.error ?? `Failed to update contract ${contractId} thread link.`
    );
  }
}

async function resolveExistingThread(args: {
  contract: StoredContractDraftClient;
  userThreads: Thread[];
  getThread: (id: string) => Promise<Thread | undefined>;
}) {
  const byMetadata = args.userThreads.find(
    (thread) => thread.metadata?.contract_id === args.contract.id
  );
  if (byMetadata) {
    return byMetadata;
  }

  if (!args.contract.threadId) {
    return undefined;
  }

  const byId = args.userThreads.find(
    (thread) => thread.thread_id === args.contract.threadId
  );
  if (byId) {
    return byId;
  }

  return args.getThread(args.contract.threadId);
}

export async function ensureContractDraftThread(args: {
  contract: StoredContractDraftClient;
  userThreads: Thread[];
  getThread: (id: string) => Promise<Thread | undefined>;
  createThread: (options?: CreateThreadOptions) => Promise<Thread | undefined>;
  updateThreadMetadata: (
    threadId: string,
    metadata: Record<string, unknown>
  ) => Promise<Thread | undefined>;
}): Promise<{
  thread: Thread;
  reusedThread: boolean;
}> {
  const existingThread = await resolveExistingThread(args);
  const reusedThread = !!existingThread;

  let thread = existingThread;
  if (!thread) {
    const seed = buildContractThreadSeed(args.contract);
    thread = await args.createThread({
      title: seed.title,
      metadata: seed.metadata,
      initialValues: seed.values,
    });
  }

  if (!thread) {
    throw new Error(`Could not create thread for contract ${args.contract.id}`);
  }

  if (args.contract.threadId !== thread.thread_id) {
    await updateContractThreadLink(args.contract.id, {
      requestId: args.contract.requestId,
      threadId: thread.thread_id,
    });
  }

  const updatedThread =
    (await args.updateThreadMetadata(thread.thread_id, {
      thread_title: args.contract.draft.title,
      source: args.contract.requestId ? "contract_request" : "contract_draft",
      contract_id: args.contract.id,
      contract_type: args.contract.draft.metadata.contractType,
      supplier_name: getSupplierName(args.contract),
      ...(args.contract.requestId ? { request_id: args.contract.requestId } : {}),
    })) ?? thread;

  return {
    thread: updatedThread,
    reusedThread,
  };
}
