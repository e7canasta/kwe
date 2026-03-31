import { v4 as uuidv4 } from "uuid";
import { useUserContext } from "@/contexts/UserContext";
import {
  isArtifactMarkdownContent,
  isDeprecatedArtifactType,
} from "@opencanvas/shared/utils/artifacts";
import { reverseCleanContent } from "@/lib/normalize_string";
import {
  ArtifactV3,
  Clause,
  CustomModelConfig,
  GraphInput,
  RewriteArtifactMetaToolResponse,
  TextHighlight,
} from "@opencanvas/shared/types";
import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { useRuns } from "@/hooks/useRuns";
import { createClient } from "@/hooks/utils";
import { DEFAULT_INPUTS } from "@opencanvas/shared/constants";
import {
  ALL_MODEL_NAMES,
  NON_STREAMING_TEXT_MODELS,
  NON_STREAMING_TOOL_CALLING_MODELS,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_MODEL_NAME,
} from "@opencanvas/shared/models";
import { Thread } from "@langchain/langgraph-sdk";
import { useToast } from "@/hooks/use-toast";
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  convertToArtifactV3,
  extractChunkFields,
  handleGenerateArtifactToolCallChunk,
  replaceOrInsertMessageChunk,
  updateHighlightedMarkdown,
  updateRewrittenArtifact,
} from "./utils";
import {
  handleRewriteArtifactThinkingModel,
  isThinkingModel,
} from "@opencanvas/shared/utils/thinking";
import { debounce } from "lodash";
import { useThreadContext } from "./ThreadProvider";
import { useAssistantContext } from "./AssistantContext";
import { StreamWorkerService } from "@/workers/graph-stream/streamWorker";
import {
  appendLocalThreadMessages,
  isLocalUIModeEnabled,
  updateLocalThreadState,
} from "@/lib/mock/local-ui";

interface GraphData {
  runId: string | undefined;
  isStreaming: boolean;
  error: boolean;
  selectedBlocks: TextHighlight | undefined;
  messages: BaseMessage[];
  artifact: ArtifactV3 | undefined;
  updateRenderedArtifactRequired: boolean;
  isArtifactSaved: boolean;
  firstTokenReceived: boolean;
  feedbackSubmitted: boolean;
  artifactUpdateFailed: boolean;
  chatStarted: boolean;
  clauseSelectorOpen: boolean;
  selectedClauses: Clause[];
  setClauseSelectorOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedClauses: Dispatch<SetStateAction<Clause[]>>;
  setChatStarted: Dispatch<SetStateAction<boolean>>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  setFeedbackSubmitted: Dispatch<SetStateAction<boolean>>;
  setArtifact: Dispatch<SetStateAction<ArtifactV3 | undefined>>;
  setSelectedBlocks: Dispatch<SetStateAction<TextHighlight | undefined>>;
  setSelectedArtifact: (index: number) => void;
  setMessages: Dispatch<SetStateAction<BaseMessage[]>>;
  streamMessage: (params: GraphInput) => Promise<void>;
  setArtifactContent: (index: number, content: string) => void;
  clearState: () => void;
  switchSelectedThread: (thread: Thread) => void;
  setUpdateRenderedArtifactRequired: Dispatch<SetStateAction<boolean>>;
}

type GraphContentType = {
  graphData: GraphData;
};

const GraphContext = createContext<GraphContentType | undefined>(undefined);

// Shim for recent LangGraph bugfix
function extractStreamDataChunk(chunk: any) {
  if (Array.isArray(chunk)) {
    return chunk[1];
  }
  return chunk;
}

function extractStreamDataOutput(output: any) {
  if (Array.isArray(output)) {
    return output[1];
  }
  return output;
}

export function GraphProvider({ children }: { children: ReactNode }) {
  const userData = useUserContext();
  const assistantsData = useAssistantContext();
  const threadData = useThreadContext();
  const { toast } = useToast();
  const { shareRun } = useRuns();
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<BaseMessage[]>([]);
  const [artifact, setArtifact] = useState<ArtifactV3>();
  const [selectedBlocks, setSelectedBlocks] = useState<TextHighlight>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [updateRenderedArtifactRequired, setUpdateRenderedArtifactRequired] =
    useState(false);
  const lastSavedArtifact = useRef<ArtifactV3 | undefined>(undefined);
  const debouncedAPIUpdate = useRef(
    debounce(
      (artifact: ArtifactV3, threadId: string) =>
        updateArtifact(artifact, threadId),
      5000
    )
  ).current;
  const [isArtifactSaved, setIsArtifactSaved] = useState(true);
  const [threadSwitched, setThreadSwitched] = useState(false);
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const [runId, setRunId] = useState<string>();
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const [artifactUpdateFailed, setArtifactUpdateFailed] = useState(false);
  const [clauseSelectorOpen, setClauseSelectorOpen] = useState(false);
  const [selectedClauses, setSelectedClauses] = useState<Clause[]>([]);
  const initialAssistantRequestedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !userData.user) return;

    if (assistantsData.selectedAssistant) {
      initialAssistantRequestedForUser.current = userData.user.id;
      return;
    }

    if (assistantsData.isLoadingAllAssistants) {
      return;
    }

    // Avoid duplicate bootstrap calls while the assistant context hydrates.
    if (initialAssistantRequestedForUser.current === userData.user.id) {
      return;
    }

    initialAssistantRequestedForUser.current = userData.user.id;
    assistantsData.getOrCreateAssistant(userData.user.id);
  }, [assistantsData, userData.user]);

  // Very hacky way of ensuring updateState is not called when a thread is switched
  useEffect(() => {
    if (threadSwitched) {
      const timer = setTimeout(() => {
        setThreadSwitched(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [threadSwitched]);

  useEffect(() => {
    return () => {
      debouncedAPIUpdate.cancel();
    };
  }, [debouncedAPIUpdate]);

  useEffect(() => {
    if (!threadData.threadId) return;
    if (!messages.length || !artifact) return;
    if (updateRenderedArtifactRequired || threadSwitched || isStreaming) return;
    const currentIndex = artifact.currentIndex;
    const currentContent = artifact.contents.find(
      (c) => c.index === currentIndex
    );
    if (!currentContent) return;
    if (
      artifact.contents.length === 1 &&
      artifact.contents[0].type === "text" &&
      !artifact.contents[0].fullMarkdown
    ) {
      // If the artifact has only one content and it's empty, we shouldn't update the state
      return;
    }

    if (
      !lastSavedArtifact.current ||
      lastSavedArtifact.current.contents !== artifact.contents
    ) {
      setIsArtifactSaved(false);
      // This means the artifact in state does not match the last saved artifact
      // We need to update
      debouncedAPIUpdate(artifact, threadData.threadId);
    }
  }, [
    artifact,
    debouncedAPIUpdate,
    isStreaming,
    messages.length,
    threadData.threadId,
    threadSwitched,
    updateRenderedArtifactRequired,
  ]);

  const searchOrCreateEffectRan = useRef(false);

  const switchSelectedThread = useCallback((thread: Thread) => {
    setUpdateRenderedArtifactRequired(true);
    setThreadSwitched(true);
    setChatStarted(true);
    setSelectedClauses([]);
    setClauseSelectorOpen(false);

    // Set the thread ID in state. Then set in cookies so a new thread
    // isn't created on page load if one already exists.
    threadData.setThreadId(thread.thread_id);

    // Set the model name and config
    if (thread.metadata?.customModelName) {
      threadData.setModelName(
        thread.metadata.customModelName as ALL_MODEL_NAMES
      );
      threadData.setModelConfig(
        thread.metadata.customModelName as ALL_MODEL_NAMES,
        thread.metadata.modelConfig as CustomModelConfig
      );
    } else {
      threadData.setModelName(DEFAULT_MODEL_NAME);
      threadData.setModelConfig(DEFAULT_MODEL_NAME, DEFAULT_MODEL_CONFIG);
    }

    const castValues: {
      artifact: ArtifactV3 | undefined;
      messages: Record<string, any>[] | undefined;
    } = {
      artifact: undefined,
      messages: (thread.values as Record<string, any>)?.messages || undefined,
    };
    const castThreadValues = thread.values as Record<string, any>;
    if (castThreadValues?.artifact) {
      if (isDeprecatedArtifactType(castThreadValues.artifact)) {
        castValues.artifact = convertToArtifactV3(castThreadValues.artifact);
      } else {
        castValues.artifact = castThreadValues.artifact;
      }
    } else {
      castValues.artifact = undefined;
    }
    lastSavedArtifact.current = castValues?.artifact;

    if (!castValues?.messages?.length) {
      setMessages([]);
      setArtifact(castValues?.artifact);
      return;
    }
    setArtifact(castValues?.artifact);
    setMessages(
      castValues.messages.map((msg: Record<string, any>) => {
        if (msg.response_metadata?.langSmithRunURL) {
          msg.tool_calls = msg.tool_calls ?? [];
          msg.tool_calls.push({
            name: "langsmith_tool_ui",
            args: { sharedRunURL: msg.response_metadata.langSmithRunURL },
            id: msg.response_metadata.langSmithRunURL
              ?.split("https://smith.langchain.com/public/")[1]
              .split("/")[0],
          });
        }
        return msg as BaseMessage;
      })
    );
  }, [threadData]);

  // Attempt to load the thread if an ID is present in query params.
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !userData.user ||
      threadData.createThreadLoading ||
      !threadData.threadId
    ) {
      return;
    }

    // Only run effect once in development
    if (searchOrCreateEffectRan.current) {
      return;
    }
    searchOrCreateEffectRan.current = true;

    threadData.getThread(threadData.threadId).then((thread) => {
      if (thread) {
        switchSelectedThread(thread);
        return;
      }

      // Failed to fetch thread. Remove from query params
      threadData.setThreadId(null);
    });
  }, [
    switchSelectedThread,
    threadData,
    threadData.threadId,
    userData.user,
  ]);

  const updateArtifact = async (
    artifactToUpdate: ArtifactV3,
    threadId: string
  ) => {
    setArtifactUpdateFailed(false);
    if (isStreaming) return;
    if (isLocalUIModeEnabled()) {
      updateLocalThreadState(threadId, artifactToUpdate);
      setIsArtifactSaved(true);
      lastSavedArtifact.current = artifactToUpdate;
      return;
    }

    try {
      const client = createClient();
      await client.threads.updateState(threadId, {
        values: {
          artifact: artifactToUpdate,
        },
      });
      setIsArtifactSaved(true);
      lastSavedArtifact.current = artifactToUpdate;
    } catch (_) {
      setArtifactUpdateFailed(true);
    }
  };

  const clearState = () => {
    setMessages([]);
    setArtifact(undefined);
    setSelectedClauses([]);
    setClauseSelectorOpen(false);
    setFirstTokenReceived(true);
  };

  const streamMessageV2 = async (params: GraphInput) => {
    setFirstTokenReceived(false);
    setError(false);
    if (!assistantsData.selectedAssistant) {
      toast({
        title: "Error",
        description: "No assistant ID found",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    let currentThreadId = threadData.threadId;
    if (!currentThreadId) {
      const newThread = await threadData.createThread();
      if (!newThread) {
        toast({
          title: "Error",
          description: "Failed to create thread",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }
      currentThreadId = newThread.thread_id;
    }

    if (isLocalUIModeEnabled()) {
      setIsStreaming(true);
      setRunId(undefined);
      setFeedbackSubmitted(false);
      try {
        const latestUserMessage = params.messages?.at(-1);
        const inputText =
          (latestUserMessage?.content as string) || "Message received";
        const localReply =
          "Local UI mode is enabled. This is a mock assistant response so you can validate the frontend without backend services.";
        const assistantMsg = new AIMessage({
          id: `local-ai-${Date.now()}`,
          content: localReply,
        });
        setMessages((prevMessages) => [...prevMessages, assistantMsg]);
        setFirstTokenReceived(true);

        if (!artifact) {
          setArtifact({
            currentIndex: 1,
            contents: [
              {
                index: 1,
                type: "text",
                title: "Local Draft",
                fullMarkdown: `${localReply}\n\nPrompt: ${inputText}`,
              },
            ],
          });
        }

        if (currentThreadId) {
          appendLocalThreadMessages(currentThreadId, inputText, localReply);
        }
      } catch (e) {
        console.error("Failed local UI mock stream", e);
      } finally {
        setSelectedBlocks(undefined);
        setIsStreaming(false);
      }
      return;
    }

    const messagesInput = {
      // `messages` contains the full, unfiltered list of messages
      messages: params.messages,
      // `_messages` contains the list of messages which are included
      // in the LLMs context, including summarization messages.
      _messages: params.messages,
    };

    // TODO: propagate highlight data back with a cleaner contract.
    const input = {
      ...DEFAULT_INPUTS,
      artifact,
      ...params,
      ...messagesInput,
      ...(selectedBlocks && {
        highlightedText: selectedBlocks,
      }),
    };
    // Add check for multiple defined fields (only maintained fields)
    const fieldsToCheck = [input.highlightedText];

    if (fieldsToCheck.filter((field) => field !== undefined).length >= 2) {
      toast({
        title: "Error",
        description:
          "Can not use multiple exclusive drafting actions at once. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    setIsStreaming(true);
    setRunId(undefined);
    setFeedbackSubmitted(false);
    // The root level run ID of this stream
    let runId = "";
    let followupMessageId = "";
    // The ID of the message containing the thinking content.
    let thinkingMessageId = "";

    try {
      const workerService = new StreamWorkerService();
      const stream = workerService.streamData({
        threadId: currentThreadId,
        assistantId: assistantsData.selectedAssistant.assistant_id,
        input,
        modelName: threadData.modelName,
        modelConfigs: threadData.modelConfigs,
      });

      // Variables to keep track of content specific to this stream
      const prevCurrentContent = artifact
        ? artifact.contents.find((a) => a.index === artifact.currentIndex)
        : undefined;

      // The new index of the artifact that is generating
      let newArtifactIndex = 1;
      if (artifact) {
        newArtifactIndex = artifact.contents.length + 1;
      }

      // The metadata generated when re-writing an artifact
      let rewriteArtifactMeta: RewriteArtifactMetaToolResponse | undefined =
        undefined;

      // For generating an artifact
      let generateArtifactToolCallStr = "";

      // All the text up until the startCharIndex
      let updatedArtifactStartContent: string | undefined = undefined;
      // All the text after the endCharIndex
      let updatedArtifactRestContent: string | undefined = undefined;
      // Whether or not the first markdown rewrite/update has been applied.
      let isFirstUpdate = true;

      // The full text content of an artifact that is being rewritten.
      // This may include thinking tokens if the model generates them.
      let fullNewArtifactContent = "";
      // The response text ONLY of the artifact that is being rewritten.
      let newArtifactContent = "";

      // The updated full markdown text when using the highlight update tool
      let highlightedText: TextHighlight | undefined = undefined;

      for await (const chunk of stream) {
        if (chunk.event === "error") {
          const errorMessage =
            chunk?.data?.message || "Unknown error. Please try again.";
          toast({
            title: "Error generating content",
            description: errorMessage,
            variant: "destructive",
            duration: 5000,
          });
          setError(true);
          setIsStreaming(false);
          break;
        }

        try {
          const {
            runId: runId_,
            event,
            langgraphNode,
            nodeInput,
            nodeChunk,
            nodeOutput,
            taskName,
          } = extractChunkFields(chunk);

          if (!runId && runId_) {
            runId = runId_;
            setRunId(runId);
          }

          if (event === "on_chain_start") {
            if (langgraphNode === "updateHighlightedText") {
              highlightedText = nodeInput?.highlightedText;
            }
          }

          if (event === "on_chat_model_stream") {
            // These are generating new messages to insert to the chat window.
            if (
              ["generateFollowup", "replyToGeneralInput"].includes(
                langgraphNode
              )
            ) {
              const message = extractStreamDataChunk(nodeChunk);
              if (!followupMessageId) {
                followupMessageId = message.id;
              }
              setMessages((prevMessages) =>
                replaceOrInsertMessageChunk(prevMessages, message)
              );
            }

            if (langgraphNode === "generateArtifact") {
              const message = extractStreamDataChunk(nodeChunk);

              // Accumulate content
              if (
                message?.tool_call_chunks?.length > 0 &&
                typeof message?.tool_call_chunks?.[0]?.args === "string"
              ) {
                generateArtifactToolCallStr += message.tool_call_chunks[0].args;
              } else if (
                message?.content &&
                typeof message?.content === "string"
              ) {
                generateArtifactToolCallStr += message.content;
              }

              // Process accumulated content with rate limiting
              const result = handleGenerateArtifactToolCallChunk(
                generateArtifactToolCallStr
              );

              if (result) {
                if (result === "continue") {
                  continue;
                } else if (typeof result === "object") {
                  if (!firstTokenReceived) {
                    setFirstTokenReceived(true);
                  }
                  // Use debounced setter to prevent too frequent updates
                  setArtifact(result);
                }
              }
            }

            if (langgraphNode === "updateHighlightedText") {
              const message = extractStreamDataChunk(nodeChunk);
              if (!message) {
                continue;
              }
              if (!artifact) {
                console.error(
                  "No artifacts found when updating highlighted markdown..."
                );
                continue;
              }
              if (!highlightedText) {
                toast({
                  title: "Error",
                  description: "No highlighted text found",
                  variant: "destructive",
                  duration: 5000,
                });
                continue;
              }
              if (!prevCurrentContent) {
                toast({
                  title: "Error",
                  description: "Original artifact not found",
                  variant: "destructive",
                  duration: 5000,
                });
                return;
              }
              if (!isArtifactMarkdownContent(prevCurrentContent)) {
                toast({
                  title: "Error",
                  description: "Received non markdown block update",
                  variant: "destructive",
                  duration: 5000,
                });
                return;
              }

              const partialUpdatedContent = message.content || "";
              const startIndexOfHighlightedText =
                highlightedText.fullMarkdown.indexOf(
                  highlightedText.markdownBlock
                );

              if (
                updatedArtifactStartContent === undefined &&
                updatedArtifactRestContent === undefined
              ) {
                // Initialize the start and rest content on first chunk
                updatedArtifactStartContent =
                  highlightedText.fullMarkdown.slice(
                    0,
                    startIndexOfHighlightedText
                  );
                updatedArtifactRestContent = highlightedText.fullMarkdown.slice(
                  startIndexOfHighlightedText +
                    highlightedText.markdownBlock.length
                );
              }

              if (
                updatedArtifactStartContent !== undefined &&
                updatedArtifactRestContent !== undefined
              ) {
                updatedArtifactStartContent += partialUpdatedContent;
              }

              const firstUpdateCopy = isFirstUpdate;
              setFirstTokenReceived(true);
              setArtifact((prev) => {
                if (!prev) {
                  throw new Error("No artifact found when updating markdown");
                }
                return updateHighlightedMarkdown(
                  prev,
                  `${updatedArtifactStartContent}${updatedArtifactRestContent}`,
                  newArtifactIndex,
                  prevCurrentContent,
                  firstUpdateCopy
                );
              });

              if (isFirstUpdate) {
                isFirstUpdate = false;
              }
            }

            // Legacy code-artifact update path removed. Only markdown updates remain.

            if (
              langgraphNode === "rewriteArtifact" &&
              taskName === "rewrite_artifact_model_call" &&
              rewriteArtifactMeta
            ) {
              if (!artifact) {
                toast({
                  title: "Error",
                  description: "Original artifact not found",
                  variant: "destructive",
                  duration: 5000,
                });
                return;
              }

              fullNewArtifactContent +=
                extractStreamDataChunk(nodeChunk)?.content || "";

              if (isThinkingModel(threadData.modelName)) {
                if (!thinkingMessageId) {
                  thinkingMessageId = `thinking-${uuidv4()}`;
                }
                newArtifactContent = handleRewriteArtifactThinkingModel({
                  newArtifactContent: fullNewArtifactContent,
                  setMessages,
                  thinkingMessageId,
                });
              } else {
                newArtifactContent = fullNewArtifactContent;
              }

              // Only text artifacts supported
              const firstUpdateCopy = isFirstUpdate;
              setFirstTokenReceived(true);
              setArtifact((prev) => {
                if (!prev) {
                  throw new Error("No artifact found when updating markdown");
                }

                const content = newArtifactContent;
                if (!rewriteArtifactMeta) {
                  console.error(
                    "No rewrite artifact meta found when updating artifact"
                  );
                  return prev;
                }

                return updateRewrittenArtifact({
                  prevArtifact: prev,
                  newArtifactContent: content,
                  rewriteArtifactMeta: rewriteArtifactMeta,
                  prevCurrentContent,
                  newArtifactIndex,
                  isFirstUpdate: firstUpdateCopy,
                });
              });

              if (isFirstUpdate) {
                isFirstUpdate = false;
              }
            }

            if (
              [
                "rewriteArtifactTheme",
                "customAction",
              ].includes(langgraphNode)
            ) {
              if (!artifact) {
                toast({
                  title: "Error",
                  description: "Original artifact not found",
                  variant: "destructive",
                  duration: 5000,
                });
                return;
              }
              if (!prevCurrentContent) {
                toast({
                  title: "Error",
                  description: "Original artifact not found",
                  variant: "destructive",
                  duration: 5000,
                });
                return;
              }

              fullNewArtifactContent +=
                extractStreamDataChunk(nodeChunk)?.content || "";

              if (isThinkingModel(threadData.modelName)) {
                if (!thinkingMessageId) {
                  thinkingMessageId = `thinking-${uuidv4()}`;
                }
                newArtifactContent = handleRewriteArtifactThinkingModel({
                  newArtifactContent: fullNewArtifactContent,
                  setMessages,
                  thinkingMessageId,
                });
              } else {
                newArtifactContent = fullNewArtifactContent;
              }

              // Only text artifacts are supported
              const firstUpdateCopy = isFirstUpdate;
              setFirstTokenReceived(true);
              setArtifact((prev) => {
                if (!prev) {
                  throw new Error("No artifact found when updating markdown");
                }

                const content = newArtifactContent;

                return updateRewrittenArtifact({
                  prevArtifact: prev ?? artifact,
                  newArtifactContent: content,
                  rewriteArtifactMeta: {
                    type: "text",
                    title: prevCurrentContent.title,
                  },
                  prevCurrentContent,
                  newArtifactIndex,
                  isFirstUpdate: firstUpdateCopy,
                });
              });

              if (isFirstUpdate) {
                isFirstUpdate = false;
              }
            }
          }

          if (event === "on_chat_model_end") {
            if (
              langgraphNode === "rewriteArtifact" &&
              taskName === "rewrite_artifact_model_call" &&
              rewriteArtifactMeta &&
              NON_STREAMING_TEXT_MODELS.some((m) => m === threadData.modelName)
            ) {
              if (!artifact) {
                toast({
                  title: "Error",
                  description: "Original artifact not found",
                  variant: "destructive",
                  duration: 5000,
                });
                return;
              }

              const message = extractStreamDataOutput(nodeOutput);

              fullNewArtifactContent += message.content || "";

              // Only text artifacts supported
              const firstUpdateCopy = isFirstUpdate;
              setFirstTokenReceived(true);
              setArtifact((prev) => {
                if (!prev) {
                  throw new Error("No artifact found when updating markdown");
                }

                const content = fullNewArtifactContent;
                if (!rewriteArtifactMeta) {
                  console.error(
                    "No rewrite artifact meta found when updating artifact"
                  );
                  return prev;
                }

                return updateRewrittenArtifact({
                  prevArtifact: prev,
                  newArtifactContent: content,
                  rewriteArtifactMeta: rewriteArtifactMeta,
                  prevCurrentContent,
                  newArtifactIndex,
                  isFirstUpdate: firstUpdateCopy,
                });
              });

              if (isFirstUpdate) {
                isFirstUpdate = false;
              }
            }

            if (
              langgraphNode === "updateHighlightedText" &&
              NON_STREAMING_TEXT_MODELS.some((m) => m === threadData.modelName)
            ) {
              const message = extractStreamDataOutput(nodeOutput);
              if (!message) {
                continue;
              }
              if (!artifact) {
                console.error(
                  "No artifacts found when updating highlighted markdown..."
                );
                continue;
              }
              if (!highlightedText) {
                toast({
                  title: "Error",
                  description: "No highlighted text found",
                  variant: "destructive",
                  duration: 5000,
                });
                continue;
              }
              if (!prevCurrentContent) {
                toast({
                  title: "Error",
                  description: "Original artifact not found",
                  variant: "destructive",
                  duration: 5000,
                });
                return;
              }
              if (!isArtifactMarkdownContent(prevCurrentContent)) {
                toast({
                  title: "Error",
                  description: "Received non markdown block update",
                  variant: "destructive",
                  duration: 5000,
                });
                return;
              }

              const partialUpdatedContent = message.content || "";
              const startIndexOfHighlightedText =
                highlightedText.fullMarkdown.indexOf(
                  highlightedText.markdownBlock
                );

              if (
                updatedArtifactStartContent === undefined &&
                updatedArtifactRestContent === undefined
              ) {
                // Initialize the start and rest content on first chunk
                updatedArtifactStartContent =
                  highlightedText.fullMarkdown.slice(
                    0,
                    startIndexOfHighlightedText
                  );
                updatedArtifactRestContent = highlightedText.fullMarkdown.slice(
                  startIndexOfHighlightedText +
                    highlightedText.markdownBlock.length
                );
              }

              if (
                updatedArtifactStartContent !== undefined &&
                updatedArtifactRestContent !== undefined
              ) {
                updatedArtifactStartContent += partialUpdatedContent;
              }

              const firstUpdateCopy = isFirstUpdate;
              setFirstTokenReceived(true);
              setArtifact((prev) => {
                if (!prev) {
                  throw new Error("No artifact found when updating markdown");
                }
                return updateHighlightedMarkdown(
                  prev,
                  `${updatedArtifactStartContent}${updatedArtifactRestContent}`,
                  newArtifactIndex,
                  prevCurrentContent,
                  firstUpdateCopy
                );
              });

              if (isFirstUpdate) {
                isFirstUpdate = false;
              }
            }

            if (
              [
                "rewriteArtifactTheme",
                "customAction",
              ].includes(langgraphNode) &&
              NON_STREAMING_TEXT_MODELS.some((m) => m === threadData.modelName)
            ) {
              if (!artifact) {
                toast({
                  title: "Error",
                  description: "Original artifact not found",
                  variant: "destructive",
                  duration: 5000,
                });
                return;
              }
              if (!prevCurrentContent) {
                toast({
                  title: "Error",
                  description: "Original artifact not found",
                  variant: "destructive",
                  duration: 5000,
                });
                return;
              }
              const message = extractStreamDataOutput(nodeOutput);
              fullNewArtifactContent += message?.content || "";

              // Only text artifacts are supported
              const firstUpdateCopy = isFirstUpdate;
              setFirstTokenReceived(true);
              setArtifact((prev) => {
                if (!prev) {
                  throw new Error("No artifact found when updating markdown");
                }

                const content = fullNewArtifactContent;

                return updateRewrittenArtifact({
                  prevArtifact: prev ?? artifact,
                  newArtifactContent: content,
                  rewriteArtifactMeta: {
                    type: "text",
                    title: prevCurrentContent.title,
                  },
                  prevCurrentContent,
                  newArtifactIndex,
                  isFirstUpdate: firstUpdateCopy,
                });
              });
            }

            if (
              ["generateFollowup", "replyToGeneralInput"].includes(
                langgraphNode
              ) &&
              !followupMessageId &&
              NON_STREAMING_TEXT_MODELS.some((m) => m === threadData.modelName)
            ) {
              const message = extractStreamDataOutput(nodeOutput);
              followupMessageId = message.id;
              setMessages((prevMessages) =>
                replaceOrInsertMessageChunk(prevMessages, message)
              );
            }
          }

          if (event === "on_chain_end") {
            if (
              langgraphNode === "rewriteArtifact" &&
              taskName === "optionally_update_artifact_meta"
            ) {
              rewriteArtifactMeta = nodeOutput;
            }

            if (
              langgraphNode === "generateArtifact" &&
              !generateArtifactToolCallStr &&
              NON_STREAMING_TOOL_CALLING_MODELS.some(
                (m) => m === threadData.modelName
              )
            ) {
              const message = nodeOutput;
              generateArtifactToolCallStr +=
                message?.tool_call_chunks?.[0]?.args || message?.content || "";
              const result = handleGenerateArtifactToolCallChunk(
                generateArtifactToolCallStr
              );
              if (result && result === "continue") {
                continue;
              } else if (result && typeof result === "object") {
                setFirstTokenReceived(true);
                setArtifact(result);
              }
            }
          }
        } catch (e: any) {
          console.error(
            "Failed to parse stream chunk",
            chunk,
            "\n\nError:\n",
            e
          );

          let errorMessage = "Unknown error. Please try again.";
          if (typeof e === "object" && e?.message) {
            errorMessage = e.message;
          }

          toast({
            title: "Error generating content",
            description: errorMessage,
            variant: "destructive",
            duration: 5000,
          });
          setError(true);
          setIsStreaming(false);
          break;
        }
      }
      lastSavedArtifact.current = artifact;
    } catch (e) {
      console.error("Failed to stream message", e);
    } finally {
      setSelectedBlocks(undefined);
      setIsStreaming(false);
    }

    if (runId) {
      // Chain `.then` to not block the stream
      shareRun(runId).then(async (sharedRunURL) => {
        setMessages((prevMessages) => {
          const newMsgs = prevMessages.map((msg) => {
            if (
              msg.id === followupMessageId &&
              !(msg as AIMessage).tool_calls?.find(
                (tc) => tc.name === "langsmith_tool_ui"
              )
            ) {
              const toolCall = {
                name: "langsmith_tool_ui",
                args: { sharedRunURL },
                id: sharedRunURL
                  ?.split("https://smith.langchain.com/public/")[1]
                  .split("/")[0],
              };
              const castMsg = msg as AIMessage;
              const newMessageWithToolCall = new AIMessage({
                ...castMsg,
                content: castMsg.content,
                id: castMsg.id,
                tool_calls: castMsg.tool_calls
                  ? [...castMsg.tool_calls, toolCall]
                  : [toolCall],
              });
              return newMessageWithToolCall;
            }

            return msg;
          });
          return newMsgs;
        });
      });
    }
  };

  const setSelectedArtifact = (index: number) => {
    setUpdateRenderedArtifactRequired(true);
    setThreadSwitched(true);

    setArtifact((prev) => {
      if (!prev) {
        toast({
          title: "Error",
          description: "No artifactV2 found",
          variant: "destructive",
          duration: 5000,
        });
        return prev;
      }
      const newArtifact = {
        ...prev,
        currentIndex: index,
      };
      lastSavedArtifact.current = newArtifact;
      return newArtifact;
    });
  };

  const setArtifactContent = (index: number, content: string) => {
    setArtifact((prev) => {
      if (!prev) {
        toast({
          title: "Error",
          description: "No artifact found",
          variant: "destructive",
          duration: 5000,
        });
        return prev;
      }
      const newArtifact = {
        ...prev,
        currentIndex: index,
        contents: prev.contents.map((a) => {
          if (a.index === index) {
            return {
              ...a,
              fullMarkdown: reverseCleanContent(content),
            };
          }
          return a;
        }),
      };
      return newArtifact;
    });
  };

  const contextValue: GraphContentType = {
    graphData: {
      runId,
      isStreaming,
      error,
      selectedBlocks,
      messages,
      artifact,
      updateRenderedArtifactRequired,
      isArtifactSaved,
      firstTokenReceived,
      feedbackSubmitted,
      chatStarted,
      artifactUpdateFailed,
      clauseSelectorOpen,
      selectedClauses,
      setClauseSelectorOpen,
      setSelectedClauses,
      setChatStarted,
      setIsStreaming,
      setFeedbackSubmitted,
      setArtifact,
      setSelectedBlocks,
      setSelectedArtifact,
      setMessages,
      streamMessage: streamMessageV2,
      setArtifactContent,
      clearState,
      switchSelectedThread,
      setUpdateRenderedArtifactRequired,
    },
  };

  return (
    <GraphContext.Provider value={contextValue}>
      {children}
    </GraphContext.Provider>
  );
}

export function useGraphContext() {
  const context = useContext(GraphContext);
  if (context === undefined) {
    throw new Error("useGraphContext must be used within a GraphProvider");
  }
  return context;
}
