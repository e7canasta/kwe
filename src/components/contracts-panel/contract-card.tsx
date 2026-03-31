import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StoredContractDraftClient } from "@/lib/contracts/contract-client";

interface ContractCardProps {
  contract: StoredContractDraftClient;
  active: boolean;
  hasDraftThread?: boolean;
  onSelect: (contract: StoredContractDraftClient) => void;
}

const formatValue = (value: string) => value.replaceAll("_", " ");

export function ContractCard(props: ContractCardProps) {
  const supplierName =
    props.contract.draft.parties.find((party) => party.role === "supplier")?.name ??
    props.contract.draft.parties[0]?.name ??
    "Unknown party";

  return (
    <button
      type="button"
      onClick={() => props.onSelect(props.contract)}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-colors",
        props.active
          ? "border-blue-300 bg-blue-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {props.contract.draft.title}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {supplierName} • {formatValue(props.contract.draft.metadata.contractType)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {props.hasDraftThread && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
              Thread linked
            </Badge>
          )}
          <Badge variant="outline">
            {formatValue(props.contract.draft.metadata.status)}
          </Badge>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-gray-600">
        {props.contract.id}
        {props.contract.requestId ? ` • ${props.contract.requestId}` : ""}
      </p>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>{props.contract.draft.parties.length} party(s)</span>
        <span>
          Updated{" "}
          {new Date(props.contract.draft.metadata.updatedAt).toLocaleDateString(
            "en-US"
          )}
        </span>
      </div>
    </button>
  );
}
