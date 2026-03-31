"use client";

import { Suspense } from "react";
import { Canvas } from "@/components/canvas";
import { AssistantProvider } from "@/contexts/AssistantContext";
import { GraphProvider } from "@/contexts/GraphContext";
import { ThreadProvider } from "@/contexts/ThreadProvider";
import { UserProvider } from "@/contexts/UserContext";

export default function Home() {
  return (
    <UserProvider>
      <AssistantProvider>
        <Suspense fallback={null}>
          <ThreadProvider>
            <GraphProvider>
              <Canvas />
            </GraphProvider>
          </ThreadProvider>
        </Suspense>
      </AssistantProvider>
    </UserProvider>
  );
}
