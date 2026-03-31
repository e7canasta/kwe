import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const REQUEST_STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "review", label: "Review" },
  { id: "in_progress", label: "In Progress" },
] as const;

interface RequestFiltersProps {
  counts: Record<string, number>;
  total: number;
  value: string;
  onChange: (value: string) => void;
}

export function RequestFilters({
  counts,
  total,
  value,
  onChange,
}: RequestFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {REQUEST_STATUS_FILTERS.map((filter) => (
        <Button
          key={filter.id}
          type="button"
          size="sm"
          variant={value === filter.id ? "default" : "outline"}
          onClick={() => onChange(filter.id)}
        >
          {filter.label}
          <Badge
            variant={value === filter.id ? "secondary" : "outline"}
            className="ml-2"
          >
            {filter.id === "all" ? total : counts[filter.id] ?? 0}
          </Badge>
        </Button>
      ))}
    </div>
  );
}
