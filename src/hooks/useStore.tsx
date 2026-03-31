import {
  ContextDocument,
} from "@opencanvas/shared/types";
import { Item } from "@langchain/langgraph-sdk";
import { CONTEXT_DOCUMENTS_NAMESPACE } from "@opencanvas/shared/constants";
import { getLocalStore, isLocalUIModeEnabled } from "@/lib/mock/local-ui";

export function useStore() {
  const putContextDocuments = async ({
    assistantId,
    documents,
  }: {
    assistantId: string;
    documents: ContextDocument[];
  }): Promise<void> => {
    if (isLocalUIModeEnabled()) {
      getLocalStore().contextDocumentsByAssistantId.set(assistantId, documents);
      return;
    }

    try {
      const res = await fetch("/api/store/put", {
        method: "POST",
        body: JSON.stringify({
          namespace: CONTEXT_DOCUMENTS_NAMESPACE,
          key: assistantId,
          value: {
            documents,
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(
          "Failed to save assistant reference files " +
            res.statusText +
            res.status
        );
      }
    } catch (e) {
      console.error("Failed to save assistant reference files.\n", e);
    }
  };

  const getContextDocuments = async (
    assistantId: string
  ): Promise<ContextDocument[] | undefined> => {
    if (isLocalUIModeEnabled()) {
      return (
        getLocalStore().contextDocumentsByAssistantId.get(assistantId) || undefined
      );
    }

    const res = await fetch("/api/store/get", {
      method: "POST",
      body: JSON.stringify({
        namespace: CONTEXT_DOCUMENTS_NAMESPACE,
        key: assistantId,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error(
        "Failed to load assistant reference files",
        res.statusText,
        res.status
      );
      return undefined;
    }

    const { item }: { item: Item | null } = await res.json();
    if (!item?.value?.documents) {
      return undefined;
    }

    return item?.value?.documents;
  };

  return {
    putContextDocuments,
    getContextDocuments,
  };
}
