import { ClauseSuggestion } from "@opencanvas/shared/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ClauseActionsProps {
  suggestions: ClauseSuggestion[];
  loading?: boolean;
  error?: string | null;
  onAddSuggestion: (suggestion: ClauseSuggestion) => void;
  onOpenLibrary: () => void;
}

export function ClauseActions({
  suggestions,
  loading,
  error,
  onAddSuggestion,
  onOpenLibrary,
}: ClauseActionsProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">
        Looking for compatible clauses...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {error}
      </div>
    );
  }

  if (!suggestions.length) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">
        No local suggestions available right now. Open the clause library to
        explore the full catalog.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.clause.id}
          className="rounded-xl border border-gray-200 bg-white p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{suggestion.clause.title}</p>
              <p className="mt-1 text-xs text-gray-500">{suggestion.reason}</p>
            </div>
            <Badge variant="outline">
              {Math.round(suggestion.confidence * 100)}%
            </Badge>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onAddSuggestion(suggestion)}
            >
              Add clause
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onOpenLibrary}>
              Open library
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
