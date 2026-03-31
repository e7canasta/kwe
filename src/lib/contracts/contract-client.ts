"use client";

import {
  ContractDraft,
  ContractMetadata,
  SelectedClause,
} from "@opencanvas/shared/types";

export interface StoredContractDraftClient {
  id: string;
  requestId?: string;
  threadId?: string;
  draft: ContractDraft;
}

export type ContractDraftWireClient = Omit<
  ContractDraft,
  "metadata" | "selectedClauses" | "validationResult"
> & {
  metadata: Omit<ContractMetadata, "createdAt" | "updatedAt" | "dueDate"> & {
    createdAt: string | Date;
    updatedAt: string | Date;
    dueDate?: string | Date;
  };
  selectedClauses: Array<
    Omit<SelectedClause, "insertedAt"> & {
      insertedAt?: string | Date;
    }
  >;
  validationResult?: Omit<NonNullable<ContractDraft["validationResult"]>, "timestamp"> & {
    timestamp: string | Date;
  };
};

export type StoredContractDraftWireClient = Omit<
  StoredContractDraftClient,
  "draft"
> & {
  draft: ContractDraftWireClient;
};

const hydrateSelectedClause = (
  clause: ContractDraftWireClient["selectedClauses"][number]
): SelectedClause => ({
  ...clause,
  insertedAt: clause.insertedAt ? new Date(clause.insertedAt) : undefined,
});

export function hydrateContractDraftClient(
  draft: ContractDraftWireClient
): ContractDraft {
  return {
    ...draft,
    metadata: {
      ...draft.metadata,
      createdAt: new Date(draft.metadata.createdAt),
      updatedAt: new Date(draft.metadata.updatedAt),
      dueDate: draft.metadata.dueDate ? new Date(draft.metadata.dueDate) : undefined,
    },
    selectedClauses: draft.selectedClauses.map(hydrateSelectedClause),
    validationResult: draft.validationResult
      ? {
          ...draft.validationResult,
          timestamp: new Date(draft.validationResult.timestamp),
        }
      : undefined,
  };
}

export function hydrateStoredContractClient(
  contract: StoredContractDraftWireClient
): StoredContractDraftClient {
  return {
    ...contract,
    draft: hydrateContractDraftClient(contract.draft),
  };
}
