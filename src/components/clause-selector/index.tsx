"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import {
  ArtifactV3,
  Clause,
  ClauseCategory,
  ValidationResult,
} from "@opencanvas/shared/types";
import { useGraphContext } from "@/contexts/GraphContext";
import { useThreadContext } from "@/contexts/ThreadProvider";
import { useToast } from "@/hooks/use-toast";
import { TighterText } from "../ui/header";
import { TooltipIconButton } from "../assistant-ui/tooltip-icon-button";
import { Input } from "@/components/ui/input";
import {
  ClauseCategoryDefinition,
  CLAUSE_CATEGORIES,
  MOCK_CLAUSES,
} from "@/lib/contracts/clause-library";
import {
  insertClausesIntoArtifact,
  validateSelectedClauses,
} from "@/lib/contracts/draft-tools";
import { ClauseSelectorLoadingSkeleton } from "./loading-skeleton";
import { ClauseCategories } from "./clause-categories";
import { ClauseCard } from "./clause-card";
import { ClausePreview } from "./clause-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ValidationStatus } from "@/components/artifacts/actions_toolbar/contract/validation-status";
import { FEATURES } from "@/lib/feature-flags";

interface ClauseSelectorProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

interface ClausesResponse {
  clauses: Clause[];
  source: "clm" | "mock";
  total: number;
}

interface CategoriesResponse {
  categories: ClauseCategoryDefinition[];
  source: "clm" | "mock";
}

interface InsertClausesResponse {
  artifact?: ArtifactV3;
  source?: "langgraph";
  accepted?: boolean;
  error?: string;
}

const mergeClauses = (current: Clause[], incoming: Clause[]) => {
  const next = new Map(current.map((clause) => [clause.id, clause]));
  incoming.forEach((clause) => next.set(clause.id, clause));
  return Array.from(next.values());
};

const EMPTY_VALIDATION_RESULT = validateSelectedClauses([], MOCK_CLAUSES);

export function ClauseSelector({ open, setOpen }: ClauseSelectorProps) {
  const { toast } = useToast();
  const { threadId } = useThreadContext();
  const {
    graphData: {
      artifact,
      selectedClauses,
      setArtifact,
      setSelectedClauses,
      setChatStarted,
    },
  } = useGraphContext();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] =
    useState<ClauseCategoryDefinition[]>(CLAUSE_CATEGORIES);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<ClauseCategory | "all">("all");
  const [activeClauseId, setActiveClauseId] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"clm" | "mock">("mock");
  const [validationResult, setValidationResult] = useState<ValidationResult>(
    EMPTY_VALIDATION_RESULT
  );
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const requestValidation = async (
    clausesToValidate: Clause[],
    signal?: AbortSignal
  ): Promise<{
    result: ValidationResult;
    error: string | null;
  }> => {
    if (!clausesToValidate.length) {
      return { result: EMPTY_VALIDATION_RESULT, error: null };
    }

    try {
      const response = await fetch("/api/rules/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedClauseIds: clausesToValidate.map((clause) => clause.id),
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Rules request failed with ${response.status}`);
      }

      return {
        result: (await response.json()) as ValidationResult,
        error: null,
      };
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw error;
      }

      console.error("Clause validation fallback engaged", error);
      return {
        result: validateSelectedClauses(clausesToValidate, MOCK_CLAUSES),
        error:
          "Using local compatibility heuristics while the rules service is unavailable.",
      };
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const [categoriesResponse, clausesResponse] = await Promise.all([
          fetch("/api/clauses/categories", { cache: "no-store" }),
          fetch("/api/clauses", { cache: "no-store" }),
        ]);

        const categoryPayload =
          (await categoriesResponse.json()) as CategoriesResponse;
        const clausePayload = (await clausesResponse.json()) as ClausesResponse;

        if (cancelled) {
          return;
        }

        setCategories(categoryPayload.categories ?? CLAUSE_CATEGORIES);
        setClauses(clausePayload.clauses ?? []);
        setDataSource(clausePayload.source ?? categoryPayload.source ?? "mock");
        setActiveClauseId((currentId) => currentId ?? clausePayload.clauses?.[0]?.id ?? null);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load clause selector data", error);
          setCategories(CLAUSE_CATEGORIES);
          setClauses([]);
          setDataSource("mock");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const counts = useMemo(() => {
    return clauses.reduce<Partial<Record<ClauseCategory, number>>>(
      (acc, clause) => {
        acc[clause.category] = (acc[clause.category] ?? 0) + 1;
        return acc;
      },
      {}
    );
  }, [clauses]);

  const filteredClauses = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();

    return clauses.filter((clause) => {
      const matchesCategory =
        selectedCategory === "all" || clause.category === selectedCategory;

      if (!matchesCategory) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        clause.title,
        clause.content,
        clause.category,
        ...(clause.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [clauses, search, selectedCategory]);

  const activeClause =
    filteredClauses.find((clause) => clause.id === activeClauseId) ??
    filteredClauses[0] ??
    null;

  const selectedIds = useMemo(
    () => new Set(selectedClauses.map((clause) => clause.id)),
    [selectedClauses]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();

    const runValidation = async () => {
      if (!selectedClauses.length) {
        setValidationResult(EMPTY_VALIDATION_RESULT);
        setRulesError(null);
        return;
      }

      setRulesLoading(true);

      try {
        const { result, error } = await requestValidation(
          selectedClauses,
          controller.signal
        );
        setValidationResult(result);
        setRulesError(error);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          setValidationResult(validateSelectedClauses(selectedClauses, MOCK_CLAUSES));
          setRulesError(
            "Using local compatibility heuristics while the rules service is unavailable."
          );
        }
      } finally {
        setRulesLoading(false);
      }
    };

    void runValidation();

    return () => controller.abort();
  }, [open, selectedClauses]);

  const toggleClauseSelection = (clause: Clause) => {
    setSelectedClauses((previous) => {
      const exists = previous.some((item) => item.id === clause.id);
      if (exists) {
        return previous.filter((item) => item.id !== clause.id);
      }

      return [...previous, clause];
    });
  };

  const applyLocalInsertion = (clausesToInsert: Clause[]) => {
    setChatStarted(true);
    setArtifact((previousArtifact) =>
      insertClausesIntoArtifact(previousArtifact, clausesToInsert)
    );
  };

  const requestAgentInsertion = async (
    clausesToInsert: Clause[]
  ): Promise<ArtifactV3> => {
    const currentContent = artifact?.contents.find(
      (content) => content.index === artifact.currentIndex
    );
    const response = await fetch("/api/draft/clauses/insert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        threadId,
        artifact,
        selectedClauseIds: clausesToInsert.map((clause) => clause.id),
        insertClauseAtPosition: currentContent?.fullMarkdown.length ?? 0,
      }),
    });

    const payload = (await response.json()) as InsertClausesResponse;
    if (!response.ok || !payload.artifact) {
      throw new Error(
        payload.error ??
          `Draft insert request failed with status ${response.status}.`
      );
    }

    return payload.artifact;
  };

  const insertClauses = async (clausesToInsert: Clause[]) => {
    if (!clausesToInsert.length) {
      return;
    }

    const nextSelectedClauses = mergeClauses(selectedClauses, clausesToInsert);
    setRulesLoading(true);

    try {
      const { result, error } = await requestValidation(nextSelectedClauses);
      setValidationResult(result);
      setRulesError(error);
      setSelectedClauses(nextSelectedClauses);

      if (!result.valid) {
        const conflictingClauseId = result.errors[0]?.clauseIds?.[0];
        if (conflictingClauseId) {
          setActiveClauseId(conflictingClauseId);
        }

        toast({
          title: "Clause set needs review",
          description:
            result.errors[0]?.message ??
            "Resolve the incompatibilities before inserting clauses.",
          duration: 5000,
          variant: "destructive",
        });
        return;
      }

      if (FEATURES.AGENT_CLAUSE_INSERTION) {
        try {
          const nextArtifact = await requestAgentInsertion(clausesToInsert);
          setChatStarted(true);
          setArtifact(nextArtifact);
        } catch (error) {
          console.warn("LangGraph clause insertion fallback engaged", error);
          applyLocalInsertion(clausesToInsert);
          toast({
            title: "Using local clause insertion",
            description:
              "LangGraph clause insertion is not available yet. The draft was updated locally.",
            duration: 4500,
          });
        }
      } else {
        applyLocalInsertion(clausesToInsert);
      }

      if (result.warnings.length) {
        toast({
          title: "Clauses inserted with warnings",
          description:
            result.warnings[0]?.message ??
            "Review the draft warnings before sending to legal review.",
          duration: 4500,
        });
      }

      setOpen(false);
    } finally {
      setRulesLoading(false);
    }
  };

  const handleInsertSelected = () => {
    void insertClauses(selectedClauses);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="flex h-screen w-full max-w-xl flex-col gap-5 border-l-[1px] border-gray-200 bg-white p-5 shadow-inner-left"
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <TighterText className="text-lg font-medium">
                Clause Library
              </TighterText>
              <p className="mt-1 text-sm text-gray-500">
                Browse reusable clauses and insert them into the active draft.
              </p>
            </div>
            <TooltipIconButton
              tooltip="Close"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </TooltipIconButton>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
            <Search className="size-4 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, topic, or tag"
              className="border-0 p-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <ClauseCategories
              categories={categories}
              counts={counts}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
            <Badge variant="outline">{dataSource.toUpperCase()}</Badge>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-h-0 overflow-y-auto pr-1">
              {loading ? (
                <ClauseSelectorLoadingSkeleton />
              ) : filteredClauses.length ? (
                <div className="flex flex-col gap-3">
                  {filteredClauses.map((clause) => (
                    <ClauseCard
                      key={clause.id}
                      clause={clause}
                      selected={selectedIds.has(clause.id)}
                      active={activeClause?.id === clause.id}
                      onToggle={toggleClauseSelection}
                      onPreview={(selectedClause) =>
                        setActiveClauseId(selectedClause.id)
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-sm text-gray-500">
                  No clauses match the current filters.
                </div>
              )}
            </div>

            <div className="min-h-0 overflow-y-auto pr-1">
              <ClausePreview
                clause={activeClause}
                selected={!!activeClause && selectedIds.has(activeClause.id)}
                onToggle={toggleClauseSelection}
                onInsert={(clause) => insertClauses([clause])}
              />
            </div>
          </div>

          {(selectedClauses.length > 0 || rulesLoading || rulesError) && (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3">
              <ValidationStatus
                validationResult={validationResult}
                loading={rulesLoading}
                error={rulesError}
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-sm text-gray-600">
              {selectedClauses.length
                ? `${selectedClauses.length} clause(s) selected`
                : "Select one or more clauses to insert into the draft"}
            </div>
            <Button
              type="button"
              onClick={handleInsertSelected}
              disabled={!selectedClauses.length}
            >
              Insert selected
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
