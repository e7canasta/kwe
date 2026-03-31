import { ContextDocument } from "@opencanvas/shared/types";

export function arrayToFileList(files: File[] | undefined) {
  if (!files || !files.length) return undefined;
  const dt = new DataTransfer();
  files?.forEach((file) => dt.items.add(file));
  return dt.files;
}

export function contextDocumentToFile(document: ContextDocument): File {
  if (document.type === "text") {
    // For text documents, create file directly from the text data
    const blob = new Blob([document.data], { type: "text/plain" });
    return new File([blob], document.name, { type: "text/plain" });
  }

  // For non-text documents, handle as base64
  let base64String = document.data;
  if (base64String.includes(",")) {
    base64String = base64String.split(",")[1];
  }

  // Fix padding if necessary
  while (base64String.length % 4 !== 0) {
    base64String += "=";
  }

  // Clean the string (remove whitespace and invalid characters)
  base64String = base64String.replace(/\s/g, "");

  try {
    // Convert base64 to binary
    const binaryString = atob(base64String);

    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create Blob from the bytes
    const blob = new Blob([bytes], { type: document.type });

    // Create File object
    return new File([blob], document.name, { type: document.type });
  } catch (error) {
    console.error("Error converting data to file:", error);
    throw error;
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(
          `Failed to convert file to base64. Received ${typeof reader.result} result.`
        );
      }
    };
    reader.onerror = (error) => reject(error);
  });
}

export async function convertDocuments(
  documents: FileList
): Promise<ContextDocument[]> {
  return Promise.all(
    Array.from(documents).map(async (doc) => ({
      name: doc.name,
      type: doc.type,
      data: await fileToBase64(doc),
    }))
  );
}
