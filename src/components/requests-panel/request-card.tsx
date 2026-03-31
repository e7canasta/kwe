import { ContractRequest } from "@opencanvas/shared/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getRequestAgingInDays } from "@/lib/contracts/request-library";

interface RequestCardProps {
  request: ContractRequest;
  active: boolean;
  hasDraftThread?: boolean;
  onSelect: (request: ContractRequest) => void;
}

export function RequestCard({
  request,
  active,
  hasDraftThread = false,
  onSelect,
}: RequestCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(request)}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-colors",
        active
          ? "border-blue-300 bg-blue-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{request.supplier.name}</p>
          <p className="mt-1 text-xs text-gray-500">
            {request.requestType} • {request.contractType.replaceAll("_", " ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasDraftThread && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
              Draft linked
            </Badge>
          )}
          <Badge variant={request.priority === "urgent" ? "destructive" : "outline"}>
            {request.priority}
          </Badge>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-gray-600">
        {request.description ?? "No description provided."}
      </p>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>{request.status.replaceAll("_", " ")}</span>
        <span>{getRequestAgingInDays(request)} day(s) open</span>
      </div>
    </button>
  );
}
