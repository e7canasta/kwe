import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const CONTRACT_STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "review", label: "Review" },
  { id: "approved", label: "Approved" },
] as const;

interface ContractFiltersProps {
  counts: Record<string, number>;
  total: number;
  value: string;
  onChange: (value: string) => void;
}

export function ContractFilters(props: ContractFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CONTRACT_STATUS_FILTERS.map((filter) => (
        <Button
          key={filter.id}
          type="button"
          size="sm"
          variant={props.value === filter.id ? "default" : "outline"}
          onClick={() => props.onChange(filter.id)}
        >
          {filter.label}
          <Badge
            variant={props.value === filter.id ? "secondary" : "outline"}
            className="ml-2"
          >
            {filter.id === "all" ? props.total : props.counts[filter.id] ?? 0}
          </Badge>
        </Button>
      ))}
    </div>
  );
}
