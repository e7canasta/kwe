import { TighterText } from "@/components/ui/header";
import { InlineContextTooltip } from "@/components/ui/inline-context-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoaderCircle } from "lucide-react";
import { UploadedFiles } from "./uploaded-file";

const ContextDocumentsWhatsThis = (): React.ReactNode => (
  <span className="flex flex-col gap-1 text-sm text-gray-600">
    <p className="text-sm text-gray-600">
      Reference files are text or PDF materials that can be attached to a
      drafting assistant. They are included when contract interactions go
      through the assistant runtime. Local draft tools may still operate
      directly on the current markdown without consulting these files.
    </p>
  </span>
);

interface ContextDocumentsProps {
  documents: FileList | undefined;
  setDocuments: React.Dispatch<React.SetStateAction<FileList | undefined>>;
  loadingDocuments: boolean;
  allDisabled: boolean;
  handleRemoveFile: (index: number) => void;
}

export function ContextDocuments(props: ContextDocumentsProps) {
  const {
    documents,
    setDocuments,
    loadingDocuments,
    allDisabled,
    handleRemoveFile,
  } = props;

  return (
    <div className="flex flex-col items-start justify-start gap-4 w-full">
      <Label htmlFor="context-documents">
        <TighterText className="flex items-center">
          Reference Files{" "}
          <span className="text-gray-600 text-sm ml-1">
            (Max 20 files - 10MB each)
          </span>
          <InlineContextTooltip cardContentClassName="w-[500px] ml-10">
            <ContextDocumentsWhatsThis />
          </InlineContextTooltip>
        </TighterText>
      </Label>
      <Input
        disabled={allDisabled}
        required={false}
        id="context-documents"
        type="file"
        multiple
        accept=".txt,.md,.json,.xml,.css,.html,.csv,.pdf,.doc,.docx"
        onChange={(e) => {
          const newFiles = e.target.files;
          if (!newFiles) return;

          // Create array from existing files if any
          const existingFiles = documents ? Array.from(documents) : [];
          const totalFileCount = existingFiles.length + newFiles.length;

          if (totalFileCount > 20) {
            alert("You can only upload up to 20 files in total");
            e.target.value = "";
            return;
          }

          const tenMbBytes = 10 * 1024 * 1024;

          for (let i = 0; i < newFiles.length; i += 1) {
            const file = newFiles[i];
            if (file.size > tenMbBytes) {
              alert(`Document "${file.name}" exceeds the 10MB size limit`);
              e.target.value = "";
              return;
            }
          }

          // Merge existing files with new files
          const mergedFiles = [...existingFiles, ...Array.from(newFiles)];

          // Create a new FileList-like object
          const dataTransfer = new DataTransfer();
          mergedFiles.forEach((file) => dataTransfer.items.add(file));

          setDocuments(dataTransfer.files);
          e.target.value = ""; // Reset input to allow selecting the same file again
        }}
      />
      {loadingDocuments && (
        <span className="text-gray-600 text-sm flex gap-2">
          Loading reference files{" "}
          <LoaderCircle className="animate-spin w-4 h-4" />
        </span>
      )}
      <UploadedFiles files={documents} handleRemoveFile={handleRemoveFile} />
    </div>
  );
}
