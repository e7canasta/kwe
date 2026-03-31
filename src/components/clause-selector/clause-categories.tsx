import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClauseCategory } from "@opencanvas/shared/types";
import { ClauseCategoryDefinition } from "@/lib/contracts/clause-library";
import { cn } from "@/lib/utils";

interface ClauseCategoriesProps {
  categories: ClauseCategoryDefinition[];
  counts: Partial<Record<ClauseCategory, number>>;
  selectedCategory: ClauseCategory | "all";
  onSelectCategory: (category: ClauseCategory | "all") => void;
}

export function ClauseCategories({
  categories,
  counts,
  selectedCategory,
  onSelectCategory,
}: ClauseCategoriesProps) {
  const total = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0);

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant={selectedCategory === "all" ? "default" : "outline"}
        className={cn("rounded-full", selectedCategory === "all" && "shadow-sm")}
        onClick={() => onSelectCategory("all")}
      >
        All clauses
        <Badge
          variant={selectedCategory === "all" ? "secondary" : "outline"}
          className="ml-2"
        >
          {total}
        </Badge>
      </Button>
      {categories.map((category) => {
        const active = selectedCategory === category.id;

        return (
          <Button
            key={category.id}
            type="button"
            variant={active ? "default" : "outline"}
            className={cn("rounded-full", active && "shadow-sm")}
            onClick={() => onSelectCategory(category.id)}
          >
            {category.name}
            <Badge variant={active ? "secondary" : "outline"} className="ml-2">
              {counts[category.id] ?? 0}
            </Badge>
          </Button>
        );
      })}
    </div>
  );
}
