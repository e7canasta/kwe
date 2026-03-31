import {
  CheckCircle2,
  FileText,
  Lightbulb,
  Scale,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ContractActionId =
  | "validate"
  | "suggest"
  | "simplify"
  | "formalize"
  | "addParty";

interface DraftActionsProps {
  activeAction: ContractActionId | null;
  onAction: (action: ContractActionId) => void;
}

const ACTIONS: Array<{
  id: ContractActionId;
  label: string;
  description: string;
  icon: typeof CheckCircle2;
}> = [
  {
    id: "validate",
    label: "Validate",
    description: "Check clause compatibility",
    icon: CheckCircle2,
  },
  {
    id: "suggest",
    label: "Suggest",
    description: "Recommend missing clauses",
    icon: Lightbulb,
  },
  {
    id: "simplify",
    label: "Simplify",
    description: "Reduce legalese in the draft",
    icon: FileText,
  },
  {
    id: "formalize",
    label: "Formalize",
    description: "Raise the legal register",
    icon: Scale,
  },
  {
    id: "addParty",
    label: "Add Party",
    description: "Insert party placeholders",
    icon: Users,
  },
];

export function DraftActions({ activeAction, onAction }: DraftActionsProps) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        const isActive = activeAction === action.id;

        return (
          <Button
            key={action.id}
            type="button"
            variant={isActive ? "default" : "outline"}
            className={cn(
              "h-auto items-start justify-start gap-3 rounded-xl px-3 py-3 text-left",
              isActive && "shadow-sm"
            )}
            onClick={() => onAction(action.id)}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span className="flex flex-col">
              <span>{action.label}</span>
              <span
                className={cn(
                  "text-xs font-normal",
                  isActive ? "text-primary-foreground/80" : "text-gray-500"
                )}
              >
                {action.description}
              </span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}
