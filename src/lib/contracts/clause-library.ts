import { Clause, ClauseCategory } from "@opencanvas/shared/types";

export interface ClauseCategoryDefinition {
  id: ClauseCategory;
  name: string;
  description: string;
  icon: string;
}

type ClauseResponseShape =
  | Clause[]
  | { clauses?: Clause[]; data?: Clause[]; items?: Clause[] };

type CategoryResponseShape =
  | ClauseCategoryDefinition[]
  | {
      categories?:
        | ClauseCategoryDefinition[]
        | Array<{ id: string; name: string; description?: string; icon?: string }>;
      data?:
        | ClauseCategoryDefinition[]
        | Array<{ id: string; name: string; description?: string; icon?: string }>;
    };

export const CLAUSE_CATEGORIES: ClauseCategoryDefinition[] = [
  {
    id: "payment_terms",
    name: "Payment Terms",
    description: "Pricing, invoicing windows, and payment obligations.",
    icon: "wallet",
  },
  {
    id: "delivery",
    name: "Delivery",
    description: "Logistics, lead times, acceptance, and delays.",
    icon: "truck",
  },
  {
    id: "liability",
    name: "Liability",
    description: "Risk allocation, indemnities, and caps.",
    icon: "shield-alert",
  },
  {
    id: "warranties",
    name: "Warranties",
    description: "Service levels, quality commitments, and remedies.",
    icon: "badge-check",
  },
  {
    id: "termination",
    name: "Termination",
    description: "Exit rights, breach handling, and survival terms.",
    icon: "door-open",
  },
  {
    id: "confidentiality",
    name: "Confidentiality",
    description: "Disclosure limits, security, and retention duties.",
    icon: "lock",
  },
  {
    id: "dispute_resolution",
    name: "Disputes",
    description: "Escalation paths, arbitration, and governing law.",
    icon: "scale",
  },
  {
    id: "force_majeure",
    name: "Force Majeure",
    description: "Unexpected events and relief obligations.",
    icon: "cloud-lightning",
  },
  {
    id: "intellectual_property",
    name: "IP",
    description: "Ownership, licensing, and use restrictions.",
    icon: "lightbulb",
  },
  {
    id: "general_provisions",
    name: "General",
    description: "Assignment, notices, amendment rules, and boilerplate.",
    icon: "file-text",
  },
];

export const MOCK_CLAUSES: Clause[] = [
  {
    id: "payment-net-45",
    title: "Net 45 Payment Terms",
    category: "payment_terms",
    content:
      "Buyer shall pay each undisputed invoice within forty-five (45) calendar days after receipt of a valid invoice. Any disputed amount must be notified in writing within five (5) business days.",
    variables: [
      {
        key: "payment_days",
        label: "Payment days",
        type: "number",
        required: true,
        defaultValue: 45,
        validation: { min: 1, max: 120 },
      },
    ],
    tags: ["invoice", "cash-flow", "standard"],
    version: "1.0",
  },
  {
    id: "delivery-sla",
    title: "Delivery Commitment and Delay Credits",
    category: "delivery",
    content:
      "Supplier shall deliver the goods according to the agreed delivery schedule. For each full week of delay attributable to Supplier, Buyer may apply service credits equal to two percent (2%) of the delayed order value, capped at ten percent (10%).",
    variables: [],
    incompatibleWith: ["delivery-best-efforts"],
    tags: ["logistics", "sla"],
    version: "1.0",
  },
  {
    id: "liability-cap-fees",
    title: "Liability Cap",
    category: "liability",
    content:
      "Except for fraud, willful misconduct, confidentiality breaches, and indemnification obligations, each party's aggregate liability under this Agreement shall not exceed the fees paid or payable during the twelve (12) months preceding the event giving rise to the claim.",
    variables: [],
    tags: ["risk", "cap"],
    version: "1.0",
  },
  {
    id: "warranty-conformance",
    title: "Conformance Warranty",
    category: "warranties",
    content:
      "Supplier warrants that all goods and services provided under this Agreement shall materially conform to the agreed specifications for a period of ninety (90) days following acceptance.",
    variables: [],
    tags: ["quality", "acceptance"],
    version: "1.0",
  },
  {
    id: "termination-for-cause",
    title: "Termination for Cause",
    category: "termination",
    content:
      "Either party may terminate this Agreement upon written notice if the other party materially breaches the Agreement and fails to cure such breach within thirty (30) days after receiving notice.",
    variables: [],
    tags: ["breach", "cure period"],
    version: "1.0",
  },
  {
    id: "confidentiality-mutual",
    title: "Mutual Confidentiality",
    category: "confidentiality",
    content:
      "Each party shall protect the other party's Confidential Information using at least the same degree of care it uses to protect its own confidential information, and in no event less than reasonable care.",
    variables: [],
    tags: ["nda", "security"],
    version: "1.0",
  },
  {
    id: "dispute-escalation-arbitration",
    title: "Escalation and Arbitration",
    category: "dispute_resolution",
    content:
      "The parties shall first escalate any dispute to executive sponsors for good-faith resolution. If unresolved within fifteen (15) business days, the dispute shall be finally settled by confidential arbitration under the agreed rules.",
    variables: [],
    tags: ["arbitration", "escalation"],
    version: "1.0",
  },
  {
    id: "force-majeure-standard",
    title: "Force Majeure",
    category: "force_majeure",
    content:
      "Neither party shall be liable for delay or failure to perform caused by events beyond its reasonable control, provided that the affected party promptly notifies the other party and uses commercially reasonable efforts to mitigate the effects.",
    variables: [],
    tags: ["excuse", "mitigation"],
    version: "1.0",
  },
  {
    id: "ip-customer-owned-deliverables",
    title: "Customer Ownership of Deliverables",
    category: "intellectual_property",
    content:
      "Upon full payment, Supplier assigns to Buyer all right, title, and interest in the custom deliverables created specifically for Buyer under this Agreement, excluding Supplier pre-existing materials and general know-how.",
    variables: [],
    tags: ["ownership", "deliverables"],
    version: "1.0",
  },
  {
    id: "general-notices-electronic",
    title: "Notices",
    category: "general_provisions",
    content:
      "Formal notices under this Agreement must be sent to the legal contacts designated by each party and shall be deemed received when delivered by courier or, for routine operational notices, when acknowledged by email.",
    variables: [],
    tags: ["operations", "boilerplate"],
    version: "1.0",
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

const coerceClauseArray = (payload: ClauseResponseShape): Clause[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.clauses ?? payload.data ?? payload.items ?? [];
};

const coerceCategoryArray = (
  payload: CategoryResponseShape
): ClauseCategoryDefinition[] => {
  const rawCategories = Array.isArray(payload)
    ? payload
    : payload.categories ?? payload.data ?? [];

  return rawCategories
    .map((category) => {
      const match = CLAUSE_CATEGORIES.find((item) => item.id === category.id);
      if (match) {
        return {
          ...match,
          name: category.name ?? match.name,
          description: category.description ?? match.description,
          icon: category.icon ?? match.icon,
        };
      }

      if (!category.id || !category.name) {
        return undefined;
      }

      return {
        id: category.id as ClauseCategory,
        name: category.name,
        description: category.description ?? "",
        icon: category.icon ?? "file-text",
      };
    })
    .filter((category): category is ClauseCategoryDefinition => !!category);
};

export function filterClauses(
  clauses: Clause[],
  filters: { category?: string | null; q?: string | null }
): Clause[] {
  const normalizedQuery = filters.q?.trim().toLowerCase();

  return clauses.filter((clause) => {
    const matchesCategory =
      !filters.category ||
      filters.category === "all" ||
      clause.category === filters.category;

    if (!matchesCategory) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      clause.title,
      clause.content,
      ...(clause.tags ?? []),
      clause.category,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function getClauseById(id: string): Clause | undefined {
  return MOCK_CLAUSES.find((clause) => clause.id === id);
}

export async function fetchClausesFromClm(
  searchParams: URLSearchParams
): Promise<Clause[] | undefined> {
  if (!process.env.CLM_API_URL) {
    return undefined;
  }

  const url = new URL("/clauses", process.env.CLM_API_URL);
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
    throw new Error(`CLM clauses request failed with ${response.status}`);
  }

  const payload = (await response.json()) as ClauseResponseShape;
  return coerceClauseArray(payload);
}

export async function fetchClauseByIdFromClm(
  id: string
): Promise<Clause | undefined> {
  if (!process.env.CLM_API_URL) {
    return undefined;
  }

  const url = new URL(`/clauses/${id}`, process.env.CLM_API_URL);
  const response = await fetch(url, {
    headers: clmHeaders(),
    cache: "no-store",
  });

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`CLM clause detail request failed with ${response.status}`);
  }

  const payload = (await response.json()) as Clause | { clause?: Clause; data?: Clause };
  if ("id" in payload) {
    return payload;
  }

  return payload.clause ?? payload.data;
}

export async function fetchClauseCategoriesFromClm(): Promise<
  ClauseCategoryDefinition[] | undefined
> {
  if (!process.env.CLM_API_URL) {
    return undefined;
  }

  const url = new URL("/clauses/categories", process.env.CLM_API_URL);
  const response = await fetch(url, {
    headers: clmHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CLM categories request failed with ${response.status}`);
  }

  const payload = (await response.json()) as CategoryResponseShape;
  return coerceCategoryArray(payload);
}
