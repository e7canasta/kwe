import {
  ContractDraft,
  ContractMetadata,
  ContractType,
  Party,
  SelectedClause,
} from "@opencanvas/shared/types";
import { MOCK_CLAUSES } from "./clause-library";

export interface StoredContractDraft {
  id: string;
  requestId?: string;
  threadId?: string;
  draft: ContractDraft;
}

export type ContractDraftWire = Omit<
  ContractDraft,
  "metadata" | "selectedClauses" | "validationResult"
> & {
  metadata: Omit<ContractMetadata, "createdAt" | "updatedAt" | "dueDate"> & {
    createdAt: string | Date;
    updatedAt: string | Date;
    dueDate?: string | Date;
  };
  selectedClauses: Array<
    Omit<SelectedClause, "insertedAt"> & {
      insertedAt?: string | Date;
    }
  >;
  validationResult?: Omit<NonNullable<ContractDraft["validationResult"]>, "timestamp"> & {
    timestamp: string | Date;
  };
};

export type StoredContractDraftWire = Omit<StoredContractDraft, "draft"> & {
  draft: ContractDraftWire;
};

type ContractsResponseShape =
  | StoredContractDraftWire[]
  | {
      contracts?: StoredContractDraftWire[];
      data?: StoredContractDraftWire[];
      items?: StoredContractDraftWire[];
    };

type SingleContractResponseShape =
  | StoredContractDraftWire
  | { contract?: StoredContractDraftWire; data?: StoredContractDraftWire };

const getNow = () => new Date();

const buildSelectedClause = (
  clauseId: string,
  filledVariables: Record<string, string | number> = {},
  insertedAt = getNow()
): SelectedClause => {
  const clause = MOCK_CLAUSES.find((item) => item.id === clauseId);
  if (!clause) {
    throw new Error(`Clause ${clauseId} not found in mock library.`);
  }

  return {
    ...clause,
    filledVariables,
    insertedAt,
  };
};

const buildDraftMarkdown = (
  title: string,
  parties: Party[],
  clauses: SelectedClause[],
  summary: string
) =>
  [
    `# ${title}`,
    "",
    "## Parties",
    "",
    ...parties.map((party) => `- ${party.role}: ${party.name}`),
    "",
    "## Business Summary",
    "",
    summary,
    "",
    ...clauses.flatMap((clause) => [`## ${clause.title}`, "", clause.content, ""]),
  ].join("\n");

const initialContracts = (): StoredContractDraft[] => [
  {
    id: "contract-001",
    requestId: "req-001",
    draft: {
      index: 1,
      type: "text",
      title: "Zenbyte Cloud Services Agreement",
      fullMarkdown: buildDraftMarkdown(
        "Zenbyte Cloud Services Agreement",
        [
          {
            id: "buyer-001",
            role: "buyer",
            name: "Northwind Procurement Hub S.A.",
            email: "legal@northwind.example",
          },
          {
            id: "supplier-zenbyte",
            role: "supplier",
            name: "Zenbyte Cloud Services LLC",
            email: "legal@zenbyte.example",
          },
        ],
        [
          buildSelectedClause("payment-net-45", { payment_days: 45 }),
          buildSelectedClause("confidentiality-mutual"),
          buildSelectedClause("termination-for-cause"),
        ],
        "Services agreement for monitoring and on-call support across LATAM entities."
      ),
      parties: [
        {
          id: "buyer-001",
          role: "buyer",
          name: "Northwind Procurement Hub S.A.",
          email: "legal@northwind.example",
        },
        {
          id: "supplier-zenbyte",
          role: "supplier",
          name: "Zenbyte Cloud Services LLC",
          email: "legal@zenbyte.example",
        },
      ],
      selectedClauses: [
        buildSelectedClause("payment-net-45", { payment_days: 45 }),
        buildSelectedClause("confidentiality-mutual"),
        buildSelectedClause("termination-for-cause"),
      ],
      metadata: {
        contractType: "service_agreement",
        status: "draft",
        createdAt: new Date("2026-03-29T10:30:00.000Z"),
        updatedAt: new Date("2026-03-31T12:00:00.000Z"),
        createdBy: "u-001",
        dueDate: new Date("2026-04-05T18:00:00.000Z"),
        externalId: "clm-contract-001",
        jurisdiction: "US-NY",
        tags: ["services", "monitoring", "latam"],
      },
    },
  },
  {
    id: "contract-002",
    requestId: "req-003",
    draft: {
      index: 1,
      type: "text",
      title: "NovaSupply Purchase Order Amendment",
      fullMarkdown: buildDraftMarkdown(
        "NovaSupply Purchase Order Amendment",
        [
          {
            id: "buyer-002",
            role: "buyer",
            name: "Andes Manufacturing Group",
            email: "ops@andes.example",
          },
          {
            id: "supplier-novasupply",
            role: "supplier",
            name: "NovaSupply Components Inc.",
            email: "bids@novasupply.example",
          },
        ],
        [
          buildSelectedClause("delivery-sla"),
          buildSelectedClause("liability-cap-fees"),
          buildSelectedClause("general-notices-electronic"),
        ],
        "Amendment to address partial deliveries, delay credits and replacement-part logistics."
      ),
      parties: [
        {
          id: "buyer-002",
          role: "buyer",
          name: "Andes Manufacturing Group",
          email: "ops@andes.example",
        },
        {
          id: "supplier-novasupply",
          role: "supplier",
          name: "NovaSupply Components Inc.",
          email: "bids@novasupply.example",
        },
      ],
      selectedClauses: [
        buildSelectedClause("delivery-sla"),
        buildSelectedClause("liability-cap-fees"),
        buildSelectedClause("general-notices-electronic"),
      ],
      metadata: {
        contractType: "purchase_order",
        status: "review",
        createdAt: new Date("2026-03-30T14:40:00.000Z"),
        updatedAt: new Date("2026-03-31T12:00:00.000Z"),
        createdBy: "u-003",
        dueDate: new Date("2026-04-02T17:00:00.000Z"),
        jurisdiction: "MX",
        tags: ["purchase-order", "amendment"],
      },
    },
  },
];

let mockContracts = initialContracts();

const clmHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (process.env.CLM_API_KEY) {
    headers["x-api-key"] = process.env.CLM_API_KEY;
    headers.Authorization = `Bearer ${process.env.CLM_API_KEY}`;
  }

  return headers;
};

const getContractsApiUrl = () => {
  if (process.env.CLM_CONTRACTS_API_URL) {
    return new URL(process.env.CLM_CONTRACTS_API_URL);
  }

  if (!process.env.CLM_API_URL) {
    return null;
  }

  return new URL("/contracts", process.env.CLM_API_URL);
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const buildContractDetailUrl = (baseUrl: URL, suffix: string) => {
  const url = new URL(baseUrl.toString());
  url.pathname = `${url.pathname.replace(/\/$/, "")}/${suffix.replace(/^\/+/, "")}`;
  return url;
};

const hydrateSelectedClause = (
  clause: ContractDraftWire["selectedClauses"][number]
): SelectedClause => ({
  ...clause,
  insertedAt: clause.insertedAt ? new Date(clause.insertedAt) : undefined,
});

export function hydrateContractDraft(draft: ContractDraftWire): ContractDraft {
  return {
    ...draft,
    metadata: {
      ...draft.metadata,
      createdAt: new Date(draft.metadata.createdAt),
      updatedAt: new Date(draft.metadata.updatedAt),
      dueDate: draft.metadata.dueDate ? new Date(draft.metadata.dueDate) : undefined,
    },
    selectedClauses: draft.selectedClauses.map(hydrateSelectedClause),
    validationResult: draft.validationResult
      ? {
          ...draft.validationResult,
          timestamp: new Date(draft.validationResult.timestamp),
        }
      : undefined,
  };
}

export function hydrateStoredContract(
  contract: StoredContractDraftWire
): StoredContractDraft {
  return {
    ...contract,
    draft: hydrateContractDraft(contract.draft),
  };
}

const coerceSingleContract = (
  payload: SingleContractResponseShape
): StoredContractDraft => {
  if ("draft" in payload) {
    return hydrateStoredContract(payload);
  }

  const contract = payload.contract ?? payload.data;
  if (!contract) {
    throw new Error("CLM contract payload missing `contract` or `data`.");
  }

  return hydrateStoredContract(contract);
};

const coerceContractArray = (
  payload: ContractsResponseShape
): StoredContractDraft[] => {
  if (Array.isArray(payload)) {
    return payload.map(hydrateStoredContract);
  }

  return (payload.contracts ?? payload.data ?? payload.items ?? []).map(
    hydrateStoredContract
  );
};

export function filterContracts(
  contracts: StoredContractDraft[],
  filters: {
    status?: string | null;
    contractType?: string | null;
    requestId?: string | null;
    threadId?: string | null;
    q?: string | null;
  }
) {
  const normalizedQuery = filters.q?.trim().toLowerCase();

  return contracts.filter((contract) => {
    const matchesRequestId =
      !filters.requestId || contract.requestId === filters.requestId;

    if (!matchesRequestId) {
      return false;
    }

    const matchesThreadId =
      !filters.threadId || contract.threadId === filters.threadId;

    if (!matchesThreadId) {
      return false;
    }

    const matchesStatus =
      !filters.status ||
      filters.status === "all" ||
      contract.draft.metadata.status === filters.status;

    if (!matchesStatus) {
      return false;
    }

    const matchesType =
      !filters.contractType ||
      filters.contractType === "all" ||
      contract.draft.metadata.contractType === filters.contractType;

    if (!matchesType) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      contract.id,
      contract.draft.title,
      contract.draft.metadata.contractType,
      contract.draft.metadata.status,
      contract.requestId ?? "",
      contract.threadId ?? "",
      contract.draft.metadata.jurisdiction ?? "",
      ...(contract.draft.metadata.tags ?? []),
      ...contract.draft.parties.map((party) => party.name),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function listContracts(): StoredContractDraft[] {
  return [...mockContracts];
}

export function getContractById(id: string): StoredContractDraft | undefined {
  return mockContracts.find((contract) => contract.id === id);
}

const buildMetadata = (
  createdBy: string,
  contractType: ContractType,
  partial?: Partial<ContractMetadata>
): ContractMetadata => ({
  contractType,
  status: partial?.status ?? "draft",
  createdAt: partial?.createdAt ?? getNow(),
  updatedAt: partial?.updatedAt ?? getNow(),
  createdBy,
  dueDate: partial?.dueDate,
  tags: partial?.tags ?? [],
  externalId: partial?.externalId,
  jurisdiction: partial?.jurisdiction ?? "US",
});

export function createContractDraft(params: {
  createdBy: string;
  title: string;
  fullMarkdown?: string;
  contractType: ContractType;
  parties?: Party[];
  selectedClauses?: SelectedClause[];
  metadata?: Partial<ContractMetadata>;
  requestId?: string;
  threadId?: string;
}): StoredContractDraft {
  const id = `contract-${crypto.randomUUID().slice(0, 8)}`;
  const parties = params.parties ?? [];
  const selectedClauses = params.selectedClauses ?? [];
  const metadata = buildMetadata(
    params.createdBy,
    params.contractType,
    params.metadata
  );

  const draft: ContractDraft = {
    index: 1,
    type: "text",
    title: params.title,
    fullMarkdown:
      params.fullMarkdown ??
      buildDraftMarkdown(
        params.title,
        parties,
        selectedClauses,
        "Add business summary here."
      ),
    parties,
    selectedClauses,
    metadata,
  };

  const contract: StoredContractDraft = {
    id,
    requestId: params.requestId,
    threadId: params.threadId,
    draft,
  };

  mockContracts = [contract, ...mockContracts];
  return contract;
}

type ContractDraftUpdates = Partial<Omit<StoredContractDraft, "draft">> & {
  draft?: Partial<ContractDraft> & {
    metadata?: Partial<ContractMetadata>;
  };
};

export function updateContractDraft(
  id: string,
  updates: ContractDraftUpdates
): StoredContractDraft | undefined {
  const current = getContractById(id);
  if (!current) {
    return undefined;
  }

  const next: StoredContractDraft = {
    ...current,
    ...updates,
    requestId: updates.requestId ?? current.requestId,
    draft: {
      ...current.draft,
      ...updates.draft,
      metadata: {
        ...current.draft.metadata,
        ...updates.draft?.metadata,
        updatedAt: getNow(),
      },
      parties: updates.draft?.parties ?? current.draft.parties,
      selectedClauses:
        updates.draft?.selectedClauses ?? current.draft.selectedClauses,
      validationResult:
        updates.draft?.validationResult ?? current.draft.validationResult,
    },
  };

  mockContracts = mockContracts.map((contract) =>
    contract.id === id ? next : contract
  );
  return next;
}

export function deleteContractDraft(id: string): StoredContractDraft | undefined {
  const current = getContractById(id);
  if (!current) {
    return undefined;
  }

  mockContracts = mockContracts.filter((contract) => contract.id !== id);
  return current;
}

export function exportContractDraft(
  contract: StoredContractDraft,
  format: "pdf" | "docx"
) {
  const extension = format === "pdf" ? "pdf" : "docx";
  const mimeType =
    format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  return {
    contractId: contract.id,
    format,
    fileName: `${slugify(contract.draft.title) || contract.id}.${extension}`,
    mimeType,
    generatedAt: getNow().toISOString(),
    content: contract.draft.fullMarkdown,
  };
}

export async function fetchContractsFromClm(
  searchParams: URLSearchParams
): Promise<StoredContractDraft[] | null> {
  const baseUrl = getContractsApiUrl();
  if (!baseUrl) {
    return null;
  }

  const url = new URL(baseUrl);
  searchParams.forEach((value, key) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    headers: clmHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CLM contracts request failed with ${response.status}`);
  }

  return coerceContractArray((await response.json()) as ContractsResponseShape);
}

export async function fetchContractByIdFromClm(
  id: string
): Promise<StoredContractDraft | null> {
  const baseUrl = getContractsApiUrl();
  if (!baseUrl) {
    return null;
  }

  const response = await fetch(buildContractDetailUrl(baseUrl, encodeURIComponent(id)), {
    headers: clmHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CLM contract detail failed with ${response.status}`);
  }

  const payload = (await response.json()) as SingleContractResponseShape;
  return coerceSingleContract(payload);
}

export async function createContractInClm(
  payload: Record<string, unknown>
): Promise<StoredContractDraft | null> {
  const baseUrl = getContractsApiUrl();
  if (!baseUrl) {
    return null;
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: clmHeaders(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CLM contract create failed with ${response.status}`);
  }

  return coerceSingleContract((await response.json()) as SingleContractResponseShape);
}

export async function updateContractInClm(
  id: string,
  payload: Record<string, unknown>
): Promise<StoredContractDraft | null> {
  const baseUrl = getContractsApiUrl();
  if (!baseUrl) {
    return null;
  }

  const response = await fetch(buildContractDetailUrl(baseUrl, encodeURIComponent(id)), {
    method: "PUT",
    headers: clmHeaders(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CLM contract update failed with ${response.status}`);
  }

  return coerceSingleContract((await response.json()) as SingleContractResponseShape);
}

export async function deleteContractInClm(id: string): Promise<boolean> {
  const baseUrl = getContractsApiUrl();
  if (!baseUrl) {
    return false;
  }

  const response = await fetch(buildContractDetailUrl(baseUrl, encodeURIComponent(id)), {
    method: "DELETE",
    headers: clmHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CLM contract delete failed with ${response.status}`);
  }

  return true;
}

export async function exportContractFromClm(
  id: string,
  format: "pdf" | "docx"
): Promise<Record<string, unknown> | null> {
  const baseUrl = getContractsApiUrl();
  if (!baseUrl) {
    return null;
  }

  const url = buildContractDetailUrl(baseUrl, `${encodeURIComponent(id)}/export`);
  url.searchParams.set("format", format);

  const response = await fetch(url, {
    method: "POST",
    headers: clmHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CLM contract export failed with ${response.status}`);
  }

  return (await response.json()) as Record<string, unknown>;
}
