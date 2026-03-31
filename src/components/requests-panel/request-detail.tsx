import { ContractRequest } from "@opencanvas/shared/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface RequestDetailProps {
  request: ContractRequest | null;
  actionLoading: boolean;
  existingDraft?: {
    threadId: string;
    contractId?: string;
  } | null;
  onAccept: (request: ContractRequest) => Promise<void>;
  onReject: (request: ContractRequest) => Promise<void>;
  onStartDraft: (request: ContractRequest) => Promise<void>;
}

export function RequestDetail({
  request,
  actionLoading,
  existingDraft,
  onAccept,
  onReject,
  onStartDraft,
}: RequestDetailProps) {
  if (!request) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm text-gray-500">
        Select a request to inspect the brief, due date, and assignment status.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-gray-900">{request.supplier.name}</p>
          <p className="mt-1 text-sm text-gray-500">
            {request.contractType.replaceAll("_", " ")} • {request.requestType}
          </p>
        </div>
        <Badge variant={request.priority === "urgent" ? "destructive" : "outline"}>
          {request.priority}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Requester</p>
          <p className="mt-1 font-medium text-gray-900">{request.requester.name}</p>
          <p className="text-gray-500">{request.requester.department ?? "Business"}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Due date</p>
          <p className="mt-1 font-medium text-gray-900">
            {new Date(request.dueDate).toLocaleDateString("en-US")}
          </p>
          <p className="text-gray-500">{request.status.replaceAll("_", " ")}</p>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">Request brief</p>
        <p className="mt-2 text-sm leading-6 text-gray-700">
          {request.description ?? "No description provided."}
        </p>
      </div>

      {!!request.attachments?.length && (
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Attachments</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {request.attachments.map((attachment) => (
              <Badge key={attachment} variant="outline">
                {attachment}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {existingDraft && (
          <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Existing draft linked
            {existingDraft.contractId ? ` · Contract ${existingDraft.contractId}` : ""}
          </div>
        )}
        <Button type="button" onClick={() => void onStartDraft(request)}>
          {existingDraft ? "Open Draft" : "Start Draft"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={actionLoading || request.status === "rejected"}
          onClick={() => void onAccept(request)}
        >
          Accept
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={actionLoading || request.status === "rejected"}
          onClick={() => void onReject(request)}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
