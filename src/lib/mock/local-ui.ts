import { Assistant, Thread } from "@langchain/langgraph-sdk";
import { Session, User } from "@supabase/supabase-js";
import { AIMessage } from "@langchain/core/messages";
import { ArtifactV3 } from "@opencanvas/shared/types";
import { isLocalOrMockAuthMode } from "@/lib/supabase/runtime";

export const LOCAL_USER_ID = "local-user";

export function isLocalUIModeEnabled() {
  return isLocalOrMockAuthMode();
}

export function getLocalMockUser(): User {
  return {
    id: LOCAL_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "local@opencanvas.dev",
    app_metadata: {},
    user_metadata: {
      full_name: "Local User",
    },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as User;
}

export function getLocalMockSession(user = getLocalMockUser()): Session {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: "local-access-token",
    refresh_token: "local-refresh-token",
    token_type: "bearer",
    expires_in: 60 * 60,
    expires_at: now + 60 * 60,
    user,
  };
}

export function getLocalDefaultAssistant(userId: string): Assistant {
  return {
    assistant_id: "local-assistant",
    graph_id: "agent",
    name: "Local Assistant",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    context: {},
    version: 1,
    metadata: {
      user_id: userId,
      is_default: true,
      iconData: {
        iconName: "User",
        iconColor: "#000000",
      },
      description: "Assistant for local UI mode.",
    },
    config: {
      configurable: {},
    },
  } as unknown as Assistant;
}

type LocalStore = {
  contextDocumentsByAssistantId: Map<string, any[]>;
  threadsById: Map<string, Thread>;
};

const localStore: LocalStore = {
  contextDocumentsByAssistantId: new Map(),
  threadsById: new Map(),
};

export function getLocalStore() {
  return localStore;
}

export function createLocalThread(params: {
  userId: string;
  modelName: string;
  modelConfig: any;
  metadata?: Record<string, unknown>;
  values?: Record<string, unknown>;
}): Thread {
  const id = `local-thread-${Date.now()}`;
  const now = new Date().toISOString();
  const values = params.values ?? {
    messages: [],
  };
  const thread = {
    thread_id: id,
    created_at: now,
    updated_at: now,
    metadata: {
      supabase_user_id: params.userId,
      customModelName: params.modelName,
      modelConfig: params.modelConfig,
      thread_title: "Local chat",
      ...(params.metadata ?? {}),
    },
    values,
    status: "idle",
    interrupts: {},
  } as unknown as Thread;
  localStore.threadsById.set(id, thread);
  return thread;
}

export function getLocalThreads(userId: string): Thread[] {
  return Array.from(localStore.threadsById.values())
    .filter((thread) => thread.metadata?.supabase_user_id === userId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function updateLocalThreadState(threadId: string, artifact: ArtifactV3) {
  const thread = localStore.threadsById.get(threadId);
  if (!thread) return;
  const now = new Date().toISOString();
  const existingValues = (thread.values as Record<string, unknown>) || {};
  localStore.threadsById.set(threadId, {
    ...thread,
    updated_at: now,
    values: {
      ...existingValues,
      artifact,
    },
  } as unknown as Thread);
}

export function updateLocalThreadMetadata(
  threadId: string,
  metadata: Record<string, unknown>
) {
  const thread = localStore.threadsById.get(threadId);
  if (!thread) return undefined;

  const now = new Date().toISOString();
  const updatedThread = {
    ...thread,
    updated_at: now,
    metadata: {
      ...(thread.metadata || {}),
      ...metadata,
    },
  } as unknown as Thread;

  localStore.threadsById.set(threadId, updatedThread);
  return updatedThread;
}

export function appendLocalThreadMessages(
  threadId: string,
  userMessage: string,
  assistantMessage: string
) {
  const thread = localStore.threadsById.get(threadId);
  if (!thread) return;
  const values = ((thread.values as Record<string, unknown>) || {}) as {
    messages?: any[];
  };
  const messages = values.messages || [];
  const now = new Date().toISOString();
  localStore.threadsById.set(threadId, {
    ...thread,
    updated_at: now,
    metadata: {
      ...(thread.metadata || {}),
      thread_title: userMessage.slice(0, 60) || "Local chat",
    },
    values: {
      ...values,
      messages: [
        ...messages,
        { type: "human", content: userMessage, id: `local-h-${Date.now()}` },
        new AIMessage({
          id: `local-ai-${Date.now()}`,
          content: assistantMessage,
        }),
      ],
    },
  } as unknown as Thread);
}
