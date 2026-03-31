"use client";

import { useEffect, useMemo, useState } from "react";
import { Scale, Sparkles, X } from "lucide-react";
import { ClauseSuggestion, ValidationResult } from "@opencanvas/shared/types";
import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGraphContext } from "@/contexts/GraphContext";
import { FEATURES } from "@/lib/feature-flags";
import { useToast } from "@/hooks/use-toast";
import { MOCK_CLAUSES } from "@/lib/contracts/clause-library";
import {
  addPartyTemplate,
  appendArtifactVersion,
  formalizeDraftText,
  simplifyDraftText,
  validateSelectedClauses,
} from "@/lib/contracts/draft-tools";
import { DraftActions, ContractActionId } from "./draft-actions";
import { ValidationStatus } from "./validation-status";
import { ClauseActions } from "./clause-actions";

export interface ActionsToolbarProps {
  isTextSelected: boolean;
}

export function ActionsToolbar({ isTextSelected }: ActionsToolbarProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeAction, setActiveAction] = useState<ContractActionId | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult>(() =>
    validateSelectedClauses([], MOCK_CLAUSES)
  );
  const [suggestions, setSuggestions] = useState<ClauseSuggestion[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const {
    graphData: {
      artifact,
      selectedClauses,
      setArtifact,
      setSelectedClauses,
      setClauseSelectorOpen,
      setChatStarted,
    },
  } = useGraphContext();

  const localValidationResult = useMemo<ValidationResult>(
    () => validateSelectedClauses(selectedClauses, MOCK_CLAUSES),
    [selectedClauses]
  );

  useEffect(() => {
    setValidationResult(localValidationResult);
    setSuggestions(localValidationResult.suggestions);
  }, [localValidationResult]);

  useEffect(() => {
    if (activeAction !== "validate" && activeAction !== "suggest") {
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      setRulesLoading(true);
      setRulesError(null);

      try {
        const endpoint =
          activeAction === "validate"
            ? "/api/rules/validate"
            : "/api/rules/suggest";

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            selectedClauseIds: selectedClauses.map((clause) => clause.id),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Rules request failed with ${response.status}`);
        }

        const payload = await response.json();
        if (activeAction === "validate") {
          setValidationResult(payload as ValidationResult);
          setSuggestions((payload as ValidationResult).suggestions ?? []);
        } else {
          setSuggestions((payload.suggestions as ClauseSuggestion[]) ?? []);
        }
      } catch (error: any) {
        if (error?.name === "AbortError") {
          return;
        }

        console.error("Rules API fallback engaged", error);
        setRulesError(
          "Using local compatibility heuristics while the rules service is unavailable."
        );
        setValidationResult(localValidationResult);
        setSuggestions(localValidationResult.suggestions);
      } finally {
        setRulesLoading(false);
      }
    };

    void run();

    return () => controller.abort();
  }, [activeAction, localValidationResult, selectedClauses]);

  if (!FEATURES.CONTRACT_TOOLBAR) {
    return null;
  }

  const currentContent = artifact?.contents.find(
    (content) => content.index === artifact.currentIndex
  );

  const updateDraft = (nextMarkdown: string, title?: string) => {
    if (!artifact || !currentContent) {
      setChatStarted(true);
      setArtifact(
        appendArtifactVersion(undefined, nextMarkdown, title ?? "New Contract Draft")
      );
      return;
    }

    setArtifact(appendArtifactVersion(artifact, nextMarkdown, title));
  };

  const handleDirectAction = (action: Extract<ContractActionId, "simplify" | "formalize" | "addParty">) => {
    const currentMarkdown = currentContent?.fullMarkdown ?? "";

    if (action === "simplify") {
      updateDraft(simplifyDraftText(currentMarkdown), currentContent?.title);
      toast({
        title: "Draft simplified",
        description: "Created a new version with lighter legal phrasing.",
        duration: 4000,
      });
      return;
    }

    if (action === "formalize") {
      updateDraft(formalizeDraftText(currentMarkdown), currentContent?.title);
      toast({
        title: "Draft formalized",
        description: "Created a new version with a more formal legal register.",
        duration: 4000,
      });
      return;
    }

    updateDraft(addPartyTemplate(currentMarkdown), currentContent?.title);
    toast({
      title: "Party section added",
      description: "Created a new draft version with party placeholders.",
      duration: 4000,
    });
  };

  const handleAction = (action: ContractActionId) => {
    if (action === "simplify" || action === "formalize" || action === "addParty") {
      handleDirectAction(action);
      setIsExpanded(false);
      setActiveAction(null);
      return;
    }

    setIsExpanded(true);
    setActiveAction(action);
  };

  const handleAddSuggestion = (suggestion: ClauseSuggestion) => {
    setSelectedClauses((previous) => {
      const exists = previous.some((clause) => clause.id === suggestion.clause.id);
      if (exists) {
        return previous;
      }
      return [...previous, suggestion.clause];
    });

    const baseMarkdown = currentContent?.fullMarkdown ?? "";
    const clauseMarkdown = `## ${suggestion.clause.title}\n\n${suggestion.clause.content}`;
    const nextMarkdown = baseMarkdown.trim()
      ? `${baseMarkdown.trim()}\n\n${clauseMarkdown}`
      : clauseMarkdown;

    updateDraft(nextMarkdown, currentContent?.title);
    toast({
      title: "Clause inserted",
      description: suggestion.reason,
      duration: 4000,
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-20 flex flex-col items-end gap-3">
      {isExpanded && (
        <div className="w-[360px] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Contract Tools</p>
              <p className="text-xs text-gray-500">
                Work on the draft without leaving the canvas.
              </p>
            </div>
            <TooltipIconButton
              tooltip="Close"
              variant="ghost"
              onClick={() => {
                setIsExpanded(false);
                setActiveAction(null);
              }}
            >
              <X className="size-4" />
            </TooltipIconButton>
          </div>

          <DraftActions activeAction={activeAction} onAction={handleAction} />

          {activeAction === "validate" && (
            <div className="mt-4">
              <ValidationStatus
                validationResult={validationResult}
                loading={rulesLoading}
                error={rulesError}
              />
            </div>
          )}

          {activeAction === "suggest" && (
            <div className="mt-4">
              <ClauseActions
                suggestions={suggestions}
                loading={rulesLoading}
                error={rulesError}
                onAddSuggestion={handleAddSuggestion}
                onOpenLibrary={() => {
                  setClauseSelectorOpen(true);
                  setIsExpanded(false);
                  setActiveAction(null);
                }}
              />
            </div>
          )}

          {!activeAction && (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-3 text-sm text-gray-500">
              Select an action to validate the draft, suggest missing clauses,
              or create a transformed draft version.
            </div>
          )}

          <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
            <span className="text-xs text-gray-600">
              {selectedClauses.length} clause(s) selected
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setClauseSelectorOpen(true)}
            >
              Clause library
            </Button>
          </div>
        </div>
      )}

      <TooltipIconButton
        tooltip={
          isTextSelected
            ? "Contract tools are disabled while text is selected"
            : "Contract tools"
        }
        variant="outline"
        className={cn(
          "h-12 w-12 rounded-xl border-gray-200 bg-white shadow-lg",
          isTextSelected && "cursor-default opacity-50 hover:bg-white"
        )}
        disabled={isTextSelected}
        onClick={() => {
          if (isTextSelected) {
            return;
          }

          setIsExpanded((previous) => !previous);
          setActiveAction(null);
        }}
      >
        {isExpanded ? (
          <Scale className="size-5 text-gray-800" />
        ) : (
          <Sparkles className="size-5 text-gray-800" />
        )}
      </TooltipIconButton>
    </div>
  );
}
