import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Clause } from "@opencanvas/shared/types";
import { cn } from "@/lib/utils";

interface ClauseCardProps {
  clause: Clause;
  selected: boolean;
  active: boolean;
  onToggle: (clause: Clause) => void;
  onPreview: (clause: Clause) => void;
}

const clampText = (text: string) =>
  text.length > 180 ? `${text.slice(0, 180).trim()}...` : text;

export function ClauseCard({
  clause,
  selected,
  active,
  onToggle,
  onPreview,
}: ClauseCardProps) {
  return (
    <Card
      className={cn(
        "w-full cursor-pointer border transition-colors",
        active && "border-blue-300 bg-blue-50/50",
        selected && "ring-1 ring-blue-300"
      )}
      onClick={() => onPreview(clause)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggle(clause)}
            onClick={(event) => event.stopPropagation()}
            className="mt-1"
          />
          <div className="flex-1">
            <CardTitle className="text-sm leading-5">{clause.title}</CardTitle>
            <CardDescription className="mt-1 capitalize">
              {clause.category.replaceAll("_", " ")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-gray-600">{clampText(clause.content)}</p>
        {!!clause.tags?.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            {clause.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
