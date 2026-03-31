import {
  ContractDraft,
  ContractMetadata,
  ContractRequest,
  Party,
} from "@opencanvas/shared/types";
import { Thread } from "@langchain/langgraph-sdk";
import { CreateThreadOptions } from "@/contexts/ThreadProvider";
import { createRequestThreadSeed } from "./request-library";

interface StoredContractDraftClient {
  id: string;
  requestId?: string;
  threadId?: string;
  draft: ContractDraft;
}

interface ContractsResponse {
  contracts?: StoredContractDraftClient[];
}

interface ContractResponse {
  contract?: StoredContractDraftClient;
}

export function findThreadForRequest(
  threads: Thread[],
  requestId: string
): Thread | undefined {
  return threads.find((thread) => thread.metadata?.request_id === requestId);
}

const buildRequestDraftParties = (request: ContractRequest): Party[] => [
  {
    id: request.requester.id,
    role: "buyer",
    name: request.requester.name,
    email: request.requester.email,
  },
  request.supplier,
];

function buildRequestContractPayload(
  request: ContractRequest,
  threadId: string
): {
  title: string;
  requestId: string;
  threadId: string;
  contractType: ContractRequest["contractType"];
  draft: Partial<Omit<ContractDraft, "metadata">> & {
    metadata: Partial<ContractMetadata>;
  };
} {
  const seed = createRequestThreadSeed(request);
  const content = seed.values.artifact.contents[0];

  return {
    title: content.title,
    requestId: request.id,
    threadId,
    contractType: request.contractType,
    draft: {
      title: content.title,
      fullMarkdown: content.fullMarkdown,
      parties: buildRequestDraftParties(request),
      selectedClauses: [],
      metadata: {
        contractType: request.contractType,
        status: "draft",
        dueDate: request.dueDate,
        tags: [request.requestType, `request:${request.id}`],
      },
    },
  };
}

async function fetchContractForRequest(
  requestId: string
): Promise<StoredContractDraftClient | undefined> {
  const response = await fetch(
    `/api/contracts?requestId=${encodeURIComponent(requestId)}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch contract for request ${requestId}`);
  }

  const payload = (await response.json()) as ContractsResponse;
  return payload.contracts?.[0];
}

async function createContractForRequest(
  request: ContractRequest,
  threadId: string
): Promise<StoredContractDraftClient> {
  const response = await fetch("/api/contracts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildRequestContractPayload(request, threadId)),
  });

  if (!response.ok) {
    throw new Error(`Failed to create contract for request ${request.id}`);
  }

  const payload = (await response.json()) as ContractResponse;
  if (!payload.contract) {
    throw new Error(`Contract response missing payload for request ${request.id}`);
  }

  return payload.contract;
}

async function updateContractThread(
  contractId: string,
  payload: { requestId?: string; threadId: string }
): Promise<StoredContractDraftClient> {
  const response = await fetch(`/api/contracts/${encodeURIComponent(contractId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update contract ${contractId}`);
  }

  const body = (await response.json()) as ContractResponse;
  if (!body.contract) {
    throw new Error(`Contract update missing payload for ${contractId}`);
  }

  return body.contract;
}

export async function ensureRequestDraftThread(args: {
  request: ContractRequest;
  userThreads: Thread[];
  createThread: (options?: CreateThreadOptions) => Promise<Thread | undefined>;
  updateThreadMetadata: (
    threadId: string,
    metadata: Record<string, unknown>
  ) => Promise<Thread | undefined>;
}): Promise<{
  thread: Thread;
  contract: StoredContractDraftClient;
  reusedThread: boolean;
}> {
  const existingThread = findThreadForRequest(args.userThreads, args.request.id);
  const reusedThread = !!existingThread;

  let thread = existingThread;
  if (!thread) {
    const seed = createRequestThreadSeed(args.request);
    thread = await args.createThread({
      title: seed.title,
      metadata: seed.metadata,
      initialValues: seed.values,
    });
  }

  if (!thread) {
    throw new Error(`Could not create thread for request ${args.request.id}`);
  }

  let contract = await fetchContractForRequest(args.request.id);
  if (!contract) {
    contract = await createContractForRequest(args.request, thread.thread_id);
  } else if (contract.threadId !== thread.thread_id) {
    contract = await updateContractThread(contract.id, {
      requestId: args.request.id,
      threadId: thread.thread_id,
    });
  }

  const updatedThread =
    (await args.updateThreadMetadata(thread.thread_id, {
      source: "contract_request",
      request_id: args.request.id,
      request_status: args.request.status,
      request_type: args.request.requestType,
      contract_id: contract.id,
      contract_type: args.request.contractType,
      supplier_name: args.request.supplier.name,
    })) ?? thread;

  return {
    thread: updatedThread,
    contract,
    reusedThread,
  };
}
