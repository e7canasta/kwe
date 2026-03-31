import {
  ArtifactMarkdownV3,
  ArtifactV3,
  Clause,
  ClauseCategory,
  ClauseSuggestion,
  ValidationError,
  ValidationResult,
} from "@opencanvas/shared/types";

const CORE_CATEGORY_LABELS: Record<ClauseCategory, string> = {
  payment_terms: "payment terms",
  delivery: "delivery",
  liability: "liability",
  warranties: "warranties",
  termination: "termination",
  confidentiality: "confidentiality",
  dispute_resolution: "dispute resolution",
  force_majeure: "force majeure",
  intellectual_property: "intellectual property",
  general_provisions: "general provisions",
};

const IMPORTANT_CATEGORIES: ClauseCategory[] = [
  "payment_terms",
  "termination",
  "confidentiality",
  "dispute_resolution",
];

const SIMPLIFY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bshall\b/gi, "must"],
  [/\bpursuant to\b/gi, "under"],
  [/\bprior to\b/gi, "before"],
  [/\bin the event that\b/gi, "if"],
  [/\bhereunder\b/gi, "under this Agreement"],
  [/\bcommence\b/gi, "start"],
  [/\bendeavor\b/gi, "try"],
];

const FORMALIZE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bmust\b/gi, "shall"],
  [/\bbefore\b/gi, "prior to"],
  [/\bif\b/gi, "in the event that"],
  [/\btry\b/gi, "use commercially reasonable efforts"],
  [/\bstart\b/gi, "commence"],
  [/\bunder this agreement\b/gi, "hereunder"],
];

const normalizeWhitespace = (text: string) =>
  text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");

const getCurrentContent = (
  artifact: ArtifactV3 | undefined
): ArtifactMarkdownV3 | undefined => {
  if (!artifact) {
    return undefined;
  }

  return artifact.contents.find((content) => content.index === artifact.currentIndex);
};

export function appendArtifactVersion(
  artifact: ArtifactV3 | undefined,
  fullMarkdown: string,
  title?: string
): ArtifactV3 {
  const currentContent = getCurrentContent(artifact);

  if (!artifact || !currentContent) {
    return {
      currentIndex: 1,
      contents: [
        {
          index: 1,
          type: "text",
          title: title ?? "Contract Draft",
          fullMarkdown,
        },
      ],
    };
  }

  const nextIndex = Math.max(...artifact.contents.map((content) => content.index)) + 1;

  return {
    ...artifact,
    currentIndex: nextIndex,
    contents: [
      ...artifact.contents,
      {
        ...currentContent,
        index: nextIndex,
        title: title ?? currentContent.title,
        fullMarkdown,
      },
    ],
  };
}

export function clausesToMarkdown(clauses: Clause[]): string {
  return clauses
    .map((clause) => `## ${clause.title}\n\n${clause.content}`)
    .join("\n\n");
}

export function insertClausesIntoArtifact(
  artifact: ArtifactV3 | undefined,
  clauses: Clause[]
): ArtifactV3 {
  const incomingMarkdown = clausesToMarkdown(clauses);

  if (!incomingMarkdown.trim()) {
    return (
      artifact ?? {
        currentIndex: 1,
        contents: [
          {
            index: 1,
            type: "text",
            title: "New Contract Draft",
            fullMarkdown: "",
          },
        ],
      }
    );
  }

  const currentContent = getCurrentContent(artifact);
  if (!artifact || !currentContent) {
    return {
      currentIndex: 1,
      contents: [
        {
          index: 1,
          type: "text",
          title: "New Contract Draft",
          fullMarkdown: incomingMarkdown,
        },
      ],
    };
  }

  const nextMarkdown = currentContent.fullMarkdown.trim()
    ? `${currentContent.fullMarkdown.trim()}\n\n${incomingMarkdown}`
    : incomingMarkdown;

  return {
    ...artifact,
    contents: artifact.contents.map((content) => {
      if (content.index !== artifact.currentIndex) {
        return content;
      }

      return {
        ...content,
        fullMarkdown: nextMarkdown,
      };
    }),
  };
}

export function simplifyDraftText(markdown: string): string {
  const simplified = SIMPLIFY_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    markdown
  );

  return normalizeWhitespace(simplified);
}

export function formalizeDraftText(markdown: string): string {
  const formalized = FORMALIZE_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    markdown
  );

  return normalizeWhitespace(formalized);
}

export function addPartyTemplate(markdown: string): string {
  const section = [
    "## Parties",
    "",
    "- Buyer: [Insert legal entity]",
    "- Supplier: [Insert legal entity]",
    "- Authorized signatory: [Insert name and title]",
    "- Notice email: [Insert legal notice email]",
  ].join("\n");

  if (!markdown.trim()) {
    return section;
  }

  if (/^## Parties\b/m.test(markdown)) {
    return `${markdown.trim()}\n\n### Additional Party\n- Role: [Buyer | Supplier | Guarantor | Other]\n- Legal entity: [Insert legal entity]\n- Signatory: [Insert name and title]`;
  }

  return `${section}\n\n${markdown.trim()}`;
}

const createValidationError = (
  severity: "error" | "warning",
  message: string,
  clauseIds?: string[],
  suggestion?: string
): ValidationError => ({
  severity,
  message,
  clauseIds,
  suggestion,
});

export function suggestClauses(
  selectedClauses: Clause[],
  clauseLibrary: Clause[]
): ClauseSuggestion[] {
  const selectedIds = new Set(selectedClauses.map((clause) => clause.id));
  const selectedCategories = new Set(selectedClauses.map((clause) => clause.category));

  const compatibleCandidates = clauseLibrary.filter((candidate) => {
    if (selectedIds.has(candidate.id)) {
      return false;
    }

    return !selectedClauses.some((selectedClause) => {
      return (
        selectedClause.incompatibleWith?.includes(candidate.id) ||
        candidate.incompatibleWith?.includes(selectedClause.id)
      );
    });
  });

  const suggestions: ClauseSuggestion[] = [];

  IMPORTANT_CATEGORIES.forEach((category) => {
    if (selectedCategories.has(category)) {
      return;
    }

    const clause = compatibleCandidates.find((candidate) => candidate.category === category);
    if (!clause) {
      return;
    }

    suggestions.push({
      clause,
      category,
      confidence: 0.84,
      reason: `Missing ${CORE_CATEGORY_LABELS[category]} coverage in the current draft.`,
    });
  });

  if (!suggestions.length) {
    compatibleCandidates.slice(0, 3).forEach((clause, index) => {
      suggestions.push({
        clause,
        category: clause.category,
        confidence: 0.65 - index * 0.05,
        reason: `Compatible clause from ${CORE_CATEGORY_LABELS[clause.category]} that can strengthen the draft.`,
      });
    });
  }

  return suggestions.slice(0, 4);
}

export function validateSelectedClauses(
  selectedClauses: Clause[],
  clauseLibrary: Clause[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const seenPairs = new Set<string>();

  selectedClauses.forEach((clause) => {
    clause.incompatibleWith?.forEach((incompatibleId) => {
      const conflictingClause = selectedClauses.find(
        (selectedClause) => selectedClause.id === incompatibleId
      );

      if (!conflictingClause) {
        return;
      }

      const key = [clause.id, conflictingClause.id].sort().join("::");
      if (seenPairs.has(key)) {
        return;
      }
      seenPairs.add(key);

      errors.push(
        createValidationError(
          "error",
          `${clause.title} conflicts with ${conflictingClause.title}.`,
          [clause.id, conflictingClause.id],
          "Keep one of the two clauses or replace one with a compatible alternative."
        )
      );
    });
  });

  const selectedCategories = new Set(selectedClauses.map((clause) => clause.category));

  IMPORTANT_CATEGORIES.forEach((category) => {
    if (!selectedClauses.length || selectedCategories.has(category)) {
      return;
    }

    warnings.push(
      createValidationError(
        "warning",
        `The draft does not yet include a ${CORE_CATEGORY_LABELS[category]} clause.`,
        undefined,
        `Add a ${CORE_CATEGORY_LABELS[category]} clause before review.`
      )
    );
  });

  if (selectedClauses.length > 6) {
    warnings.push(
      createValidationError(
        "warning",
        "The draft already contains many selected clauses. Confirm there is no duplication or overlap.",
        selectedClauses.map((clause) => clause.id)
      )
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions: suggestClauses(selectedClauses, clauseLibrary),
    timestamp: new Date(),
  };
}
