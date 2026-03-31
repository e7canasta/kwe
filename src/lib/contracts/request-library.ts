import { ArtifactV3, ContractRequest } from "@opencanvas/shared/types";

export type ContractRequestWire = Omit<
  ContractRequest,
  "dueDate" | "createdAt"
> & {
  dueDate: string | Date;
  createdAt: string | Date;
};

export interface RequestThreadSeed {
  title: string;
  metadata: Record<string, unknown>;
  values: {
    artifact: ArtifactV3;
    messages: Array<Record<string, unknown>>;
  };
}

type RequestResponseShape =
  | ContractRequestWire[]
  | {
      requests?: ContractRequestWire[];
      data?: ContractRequestWire[];
      items?: ContractRequestWire[];
    };

type SingleRequestResponseShape =
  | ContractRequestWire
  | { request?: ContractRequestWire; data?: ContractRequestWire };

const now = new Date("2026-03-31T12:00:00.000Z");

export const MOCK_REQUESTS: ContractRequest[] = [
  {
    id: "req-001",
    requestType: "new",
    contractType: "service_agreement",
    supplier: {
      id: "supplier-zenbyte",
      role: "supplier",
      name: "Zenbyte Cloud Services LLC",
      email: "legal@zenbyte.example",
    },
    requester: {
      id: "u-001",
      name: "Marina Soto",
      email: "marina.soto@example.com",
      department: "Procurement",
    },
    dueDate: new Date("2026-04-05T18:00:00.000Z"),
    status: "pending",
    priority: "high",
    description:
      "Need a services agreement for infrastructure monitoring and on-call support across three LATAM entities.",
    attachments: ["SOW-v3.pdf", "Security-Requirements.pdf"],
    createdAt: new Date("2026-03-29T10:30:00.000Z"),
    assignedTo: "legal-ops-1",
  },
  {
    id: "req-002",
    requestType: "renewal",
    contractType: "master_agreement",
    supplier: {
      id: "supplier-logifleet",
      role: "supplier",
      name: "LogiFleet Transport S.A.",
      email: "contracts@logifleet.example",
    },
    requester: {
      id: "u-002",
      name: "Carlos Vega",
      email: "carlos.vega@example.com",
      department: "Operations",
    },
    dueDate: new Date("2026-04-08T20:00:00.000Z"),
    status: "review",
    priority: "medium",
    description:
      "Renew existing transport framework agreement with updated liability cap and service credit schedule.",
    attachments: ["Renewal-Notes.docx"],
    createdAt: new Date("2026-03-28T09:15:00.000Z"),
    assignedTo: "legal-ops-2",
  },
  {
    id: "req-003",
    requestType: "amendment",
    contractType: "purchase_order",
    supplier: {
      id: "supplier-novasupply",
      role: "supplier",
      name: "NovaSupply Components Inc.",
      email: "bids@novasupply.example",
    },
    requester: {
      id: "u-003",
      name: "Lucia Arce",
      email: "lucia.arce@example.com",
      department: "Supply Chain",
    },
    dueDate: new Date("2026-04-02T17:00:00.000Z"),
    status: "pending",
    priority: "urgent",
    description:
      "Amend open purchase order terms to address partial deliveries and expedite replacement parts.",
    attachments: ["PO-4451.pdf", "Vendor-Email.msg"],
    createdAt: new Date("2026-03-30T14:40:00.000Z"),
    assignedTo: "legal-ops-1",
  },
  {
    id: "req-004",
    requestType: "new",
    contractType: "nda",
    supplier: {
      id: "supplier-auralabs",
      role: "supplier",
      name: "AuraLabs Analytics Ltd.",
      email: "privacy@auralabs.example",
    },
    requester: {
      id: "u-004",
      name: "Diego Mena",
      email: "diego.mena@example.com",
      department: "Data Partnerships",
    },
    dueDate: new Date("2026-04-10T19:00:00.000Z"),
    status: "in_progress",
    priority: "low",
    description:
      "Mutual NDA required before technical diligence and sample dataset exchange.",
    createdAt: new Date("2026-03-27T11:00:00.000Z"),
    assignedTo: "legal-ops-3",
  },
];

const clmHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (process.env.CLM_API_KEY) {
    headers["x-api-key"] = process.env.CLM_API_KEY;
    headers.Authorization = `Bearer ${process.env.CLM_API_KEY}`;
  }

  return headers;
};

const coerceRequestArray = (payload: RequestResponseShape): ContractRequest[] => {
  if (Array.isArray(payload)) {
    return hydrateRequests(payload);
  }

  return hydrateRequests(payload.requests ?? payload.data ?? payload.items ?? []);
};

export function hydrateRequest(request: ContractRequestWire): ContractRequest {
  return {
    ...request,
    dueDate: new Date(request.dueDate),
    createdAt: new Date(request.createdAt),
  };
}

export function hydrateRequests(requests: ContractRequestWire[]): ContractRequest[] {
  return requests.map(hydrateRequest);
}

export function filterRequests(
  requests: ContractRequest[],
  filters: { status?: string | null; q?: string | null }
) {
  const normalizedQuery = filters.q?.trim().toLowerCase();

  return requests.filter((request) => {
    const matchesStatus =
      !filters.status || filters.status === "all" || request.status === filters.status;

    if (!matchesStatus) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      request.supplier.name,
      request.requester.name,
      request.contractType,
      request.requestType,
      request.priority,
      request.status,
      request.description ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function getRequestById(id: string): ContractRequest | undefined {
  return MOCK_REQUESTS.find((request) => request.id === id);
}

export function applyRequestAction(
  request: ContractRequest,
  action: "accept" | "reject"
): ContractRequest {
  if (action === "accept") {
    return {
      ...request,
      status: "in_progress",
      assignedTo: request.assignedTo ?? "current-user",
    };
  }

  return {
    ...request,
    status: "rejected",
  };
}

export function requestToDraftMarkdown(request: ContractRequest): string {
  return [
    `# ${request.contractType.replaceAll("_", " ").toUpperCase()} Draft`,
    "",
    "## Request Summary",
    "",
    `- Request ID: ${request.id}`,
    `- Request type: ${request.requestType}`,
    `- Priority: ${request.priority}`,
    `- Due date: ${new Date(request.dueDate).toLocaleDateString("en-US")}`,
    "",
    "## Parties",
    "",
    `- Requester: ${request.requester.name} (${request.requester.department ?? "Business"})`,
    `- Supplier: ${request.supplier.name}`,
    "",
    "## Business Context",
    "",
    request.description ?? "Add request details here.",
    "",
    "## Required Clauses",
    "",
    "- Scope of work",
    "- Commercial terms",
    "- Confidentiality",
    "- Liability and remedies",
    "- Termination",
  ].join("\n");
}

export function createRequestThreadSeed(
  request: ContractRequest
): RequestThreadSeed {
  const contractTypeLabel = request.contractType.replaceAll("_", " ");
  const title = `${request.supplier.name} · ${contractTypeLabel}`;
  const draftTitle = `${request.supplier.name} Request Draft`;
  const dueDateLabel = new Date(request.dueDate).toLocaleDateString("en-US");
  const markdown = requestToDraftMarkdown(request);

  return {
    title,
    metadata: {
      thread_title: title,
      source: "contract_request",
      request_id: request.id,
      request_status: request.status,
      request_type: request.requestType,
      contract_type: request.contractType,
      supplier_name: request.supplier.name,
    },
    values: {
      artifact: {
        currentIndex: 1,
        contents: [
          {
            index: 1,
            type: "text",
            title: draftTitle,
            fullMarkdown: markdown,
          },
        ],
      },
      messages: [
        {
          id: `request-human-${request.id}`,
          type: "human",
          content: `Start a ${contractTypeLabel} draft for request ${request.id}.`,
        },
        {
          id: `request-ai-${request.id}`,
          type: "ai",
          content: `Request ${request.id} loaded for ${request.supplier.name}. Draft seeded with due date ${dueDateLabel}.`,
        },
      ],
    },
  };
}

export async function fetchRequestsFromClm(
  searchParams: URLSearchParams
): Promise<ContractRequest[] | undefined> {
  if (!process.env.CLM_API_URL) {
    return undefined;
  }

  const url = new URL("/requests", process.env.CLM_API_URL);
  searchParams.forEach((value, key) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    headers: clmHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CLM requests request failed with ${response.status}`);
  }

  const payload = (await response.json()) as RequestResponseShape;
  return coerceRequestArray(payload);
}

export async function fetchRequestByIdFromClm(
  id: string
): Promise<ContractRequest | undefined> {
  if (!process.env.CLM_API_URL) {
    return undefined;
  }

  const url = new URL(`/requests/${id}`, process.env.CLM_API_URL);
  const response = await fetch(url, {
    headers: clmHeaders(),
    cache: "no-store",
  });

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`CLM request detail failed with ${response.status}`);
  }

  const payload = (await response.json()) as SingleRequestResponseShape;
  if ("id" in payload) {
    return hydrateRequest(payload);
  }

  return payload.request ? hydrateRequest(payload.request) : payload.data ? hydrateRequest(payload.data) : undefined;
}

export async function postRequestActionToClm(
  id: string,
  action: "accept" | "reject"
): Promise<ContractRequest | undefined> {
  if (!process.env.CLM_API_URL) {
    return undefined;
  }

  const url = new URL(`/requests/${id}`, process.env.CLM_API_URL);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...clmHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CLM request action failed with ${response.status}`);
  }

  const payload = (await response.json()) as SingleRequestResponseShape;
  if ("id" in payload) {
    return hydrateRequest(payload);
  }

  return payload.request ? hydrateRequest(payload.request) : payload.data ? hydrateRequest(payload.data) : undefined;
}

export function getRequestAgingInDays(request: ContractRequest): number {
  const createdAt = new Date(request.createdAt).getTime();
  return Math.max(0, Math.round((now.getTime() - createdAt) / (1000 * 60 * 60 * 24)));
}
