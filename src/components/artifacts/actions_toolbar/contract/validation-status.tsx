import { ValidationResult } from "@opencanvas/shared/types";
import { Badge } from "@/components/ui/badge";

interface ValidationStatusProps {
  validationResult: ValidationResult;
  loading?: boolean;
  error?: string | null;
}

export function ValidationStatus({
  validationResult,
  loading,
  error,
}: ValidationStatusProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">
        Running compatibility checks...
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2">
        <div>
          <p className="text-sm font-medium">
            {validationResult.valid ? "Draft looks compatible" : "Review required"}
          </p>
          <p className="text-xs text-gray-500">
            {validationResult.errors.length} error(s), {validationResult.warnings.length} warning(s)
          </p>
        </div>
        <Badge variant={validationResult.valid ? "default" : "destructive"}>
          {validationResult.valid ? "Pass" : "Issues"}
        </Badge>
      </div>

      {!!validationResult.errors.length && (
        <div className="space-y-2">
          {validationResult.errors.map((error, index) => (
            <div
              key={`validation-error-${index}`}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              <p>{error.message}</p>
              {error.suggestion && (
                <p className="mt-1 text-xs text-red-700">{error.suggestion}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {!!validationResult.warnings.length && (
        <div className="space-y-2">
          {validationResult.warnings.map((warning, index) => (
            <div
              key={`validation-warning-${index}`}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              <p>{warning.message}</p>
              {warning.suggestion && (
                <p className="mt-1 text-xs text-amber-800">
                  {warning.suggestion}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
