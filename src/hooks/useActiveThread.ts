"use client";

import { Thread } from "@langchain/langgraph-sdk";
import { useEffect, useMemo, useState } from "react";
import { useThreadContext } from "@/contexts/ThreadProvider";

export function useActiveThread(): Thread | null {
  const { threadId, userThreads, getThread } = useThreadContext();
  const [resolvedThread, setResolvedThread] = useState<Thread | null>(null);

  const currentThread = useMemo(() => {
    const fromList = userThreads.find((thread) => thread.thread_id === threadId);
    if (fromList) {
      return fromList;
    }
    if (resolvedThread?.thread_id === threadId) {
      return resolvedThread;
    }
    return null;
  }, [resolvedThread, threadId, userThreads]);

  useEffect(() => {
    if (!threadId) {
      setResolvedThread(null);
      return;
    }

    const fromList = userThreads.find((thread) => thread.thread_id === threadId);
    if (fromList) {
      setResolvedThread((current) =>
        current?.thread_id === fromList.thread_id ? current : fromList
      );
      return;
    }

    let cancelled = false;

    getThread(threadId)
      .then((thread) => {
        if (!cancelled && thread) {
          setResolvedThread(thread);
        }
      })
      .catch((error) => {
        console.error("Failed to resolve active thread", error);
      });

    return () => {
      cancelled = true;
    };
  }, [getThread, threadId, userThreads]);

  return currentThread;
}
