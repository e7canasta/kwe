import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clause } from "@opencanvas/shared/types";

interface ClausePreviewProps {
  clause: Clause | null;
  selected: boolean;
  onToggle: (clause: Clause) => void;
  onInsert: (clause: Clause) => Promise<void>;
}

export function ClausePreview({
  clause,
  selected,
  onToggle,
  onInsert,
}: ClausePreviewProps) {
  if (!clause) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="p-6 text-sm text-gray-500">
          Select a clause to review its full text, variables, and compatibility
          notes.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{clause.title}</CardTitle>
            <p className="mt-1 text-sm text-gray-500 capitalize">
              {clause.category.replaceAll("_", " ")}
            </p>
          </div>
          <Badge variant={selected ? "default" : "outline"}>
            {selected ? "Selected" : "Preview"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-gray-700">{clause.content}</p>

        {!!clause.variables.length && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Variables
            </p>
            <div className="flex flex-wrap gap-2">
              {clause.variables.map((variable) => (
                <Badge key={variable.key} variant="outline">
                  {variable.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {!!clause.incompatibleWith?.length && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Compatibility
            </p>
            <p className="text-sm text-gray-600">
              Potential conflicts with: {clause.incompatibleWith.join(", ")}
            </p>
          </div>
        )}

        {!!clause.tags?.length && (
          <div className="flex flex-wrap gap-2">
            {clause.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="button" variant={selected ? "secondary" : "outline"} onClick={() => onToggle(clause)}>
            {selected ? "Remove from selection" : "Select clause"}
          </Button>
          <Button type="button" onClick={() => void onInsert(clause)}>
            Insert now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
