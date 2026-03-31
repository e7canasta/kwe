import { cleanContent } from "@/lib/normalize_string";
import {
  Artifact,
  ArtifactMarkdownV3,
  ArtifactToolResponse,
  ArtifactV3,
  RewriteArtifactMetaToolResponse,
} from "@opencanvas/shared/types";
import {
  AIMessage,
  BaseMessage,
  BaseMessageChunk,
} from "@langchain/core/messages";
import { parsePartialJson } from "@langchain/core/output_parsers";

export const replaceOrInsertMessageChunk = (
  prevMessages: BaseMessage[],
  newMessageChunk: BaseMessageChunk
): BaseMessage[] => {
  const existingMessageIndex = prevMessages.findIndex(
    (msg) => msg.id === newMessageChunk.id
  );

  if (
    prevMessages[existingMessageIndex]?.content &&
    typeof prevMessages[existingMessageIndex]?.content !== "string"
  ) {
    throw new Error("Message content is not a string");
  }
  if (typeof newMessageChunk.content !== "string") {
    throw new Error("Message chunk content is not a string");
  }

  if (existingMessageIndex !== -1) {
    // Create a new array with the updated message
    return [
      ...prevMessages.slice(0, existingMessageIndex),
      new AIMessage({
        ...prevMessages[existingMessageIndex],
        content:
          (prevMessages[existingMessageIndex]?.content || "") +
          (newMessageChunk?.content || ""),
      }),
      ...prevMessages.slice(existingMessageIndex + 1),
    ];
  } else {
    const newMessage = new AIMessage({
      ...newMessageChunk,
    });
    return [...prevMessages, newMessage];
  }
};

export const createNewGeneratedArtifactFromTool = (
  artifactTool: ArtifactToolResponse
): ArtifactMarkdownV3 | undefined => {
  if (typeof artifactTool.artifact !== "string") {
    console.error("Received new artifact without markdown content");
    return;
  }

  if (artifactTool.type && artifactTool.type !== "text") {
    console.warn(
      "Received legacy non-text artifact response; treating artifact as markdown."
    );
  }

  return {
    index: 1,
    type: "text",
    title: artifactTool.title || "",
    fullMarkdown: artifactTool.artifact,
  };
};

const validateNewArtifactIndex = (
  newArtifactIndexGuess: number,
  prevArtifactContentsLength: number,
  isFirstUpdate: boolean
): number => {
  if (isFirstUpdate) {
    // For first updates, currentIndex should be one more than the total prev contents
    // to append the new content at the end
    if (newArtifactIndexGuess !== prevArtifactContentsLength + 1) {
      return prevArtifactContentsLength + 1;
    }
  } else {
    if (newArtifactIndexGuess !== prevArtifactContentsLength) {
      // For subsequent updates, currentIndex should match the total contents
      // to update the latest content in place
      return prevArtifactContentsLength;
    }
  }
  // If the guess is correct, return the guess
  return newArtifactIndexGuess;
};

export const updateHighlightedMarkdown = (
  prevArtifact: ArtifactV3,
  content: string,
  newArtifactIndex: number,
  prevCurrentContent: ArtifactMarkdownV3,
  isFirstUpdate: boolean
): ArtifactV3 | undefined => {
  // Create a deep copy of the previous artifact
  const basePrevArtifact = {
    ...prevArtifact,
    contents: prevArtifact.contents.map((c) => ({ ...c })),
  };

  const currentIndex = validateNewArtifactIndex(
    newArtifactIndex,
    basePrevArtifact.contents.length,
    isFirstUpdate
  );

  let newContents: ArtifactMarkdownV3[];

  if (isFirstUpdate) {
    const newMarkdownContent: ArtifactMarkdownV3 = {
      ...prevCurrentContent,
      index: currentIndex,
      fullMarkdown: content,
    };
    newContents = [...basePrevArtifact.contents, newMarkdownContent];
  } else {
    newContents = basePrevArtifact.contents.map((c) => {
      if (c.index === currentIndex) {
        return {
          ...c,
          fullMarkdown: content,
        };
      }
      return { ...c }; // Create new reference for unchanged items too
    });
  }

  // Create new reference for the entire artifact
  const newArtifact: ArtifactV3 = {
    ...basePrevArtifact,
    currentIndex,
    contents: newContents,
  };

  // Verify we're actually creating a new reference
  if (Object.is(newArtifact, prevArtifact)) {
    console.warn("Warning: updateHighlightedMarkdown returned same reference");
  }

  return newArtifact;
};

// Legacy code-artifact rewriting has been removed. Only markdown updates remain.

interface UpdateRewrittenArtifactArgs {
  prevArtifact: ArtifactV3;
  newArtifactContent: string;
  rewriteArtifactMeta: RewriteArtifactMetaToolResponse;
  prevCurrentContent?: ArtifactMarkdownV3;
  newArtifactIndex: number;
  isFirstUpdate: boolean;
}

export const updateRewrittenArtifact = ({
  prevArtifact,
  newArtifactContent,
  rewriteArtifactMeta,
  prevCurrentContent,
  newArtifactIndex,
  isFirstUpdate,
}: UpdateRewrittenArtifactArgs): ArtifactV3 => {
  // Create a deep copy of the previous artifact
  const basePrevArtifact = {
    ...prevArtifact,
    contents: prevArtifact.contents.map((c) => ({ ...c })),
  };

  const currentIndex = validateNewArtifactIndex(
    newArtifactIndex,
    basePrevArtifact.contents.length,
    isFirstUpdate
  );

  let artifactContents: ArtifactMarkdownV3[];

  if (isFirstUpdate) {
    artifactContents = [
      ...basePrevArtifact.contents,
      {
        index: currentIndex,
        type: "text",
        title: rewriteArtifactMeta?.title ?? prevCurrentContent?.title ?? "",
        fullMarkdown: newArtifactContent,
      },
    ];
  } else {
    artifactContents = basePrevArtifact.contents.map((c) => {
      if (c.index === currentIndex) {
        return {
          ...c,
          fullMarkdown: newArtifactContent,
        };
      }
      return { ...c };
    });
  }

  const newArtifact: ArtifactV3 = {
    ...basePrevArtifact,
    currentIndex,
    contents: artifactContents,
  };

  // Verify we're actually creating a new reference
  if (Object.is(newArtifact, prevArtifact)) {
    console.warn("Warning: updateRewrittenArtifact returned same reference");
  }

  return newArtifact;
};

const convertLegacyContentToMarkdown = (content: Artifact["contents"][number]) => {
  if (content.type === "text") {
    return content.content;
  }

  // Backward compatibility: old code artifacts are preserved as fenced markdown.
  return [
    content.language ? `\`\`\`${content.language}` : "```",
    content.content,
    "```",
  ].join("\n");
};

export const convertToArtifactV3 = (oldArtifact: Artifact): ArtifactV3 => {
  let currentIndex = oldArtifact.currentContentIndex;
  if (currentIndex > oldArtifact.contents.length) {
    // If the value to be set in `currentIndex` is greater than the total number of contents,
    // set it to the last index so that the user can see the latest content.
    currentIndex = oldArtifact.contents.length;
  }

  const v3: ArtifactV3 = {
    currentIndex,
    contents: oldArtifact.contents.map((content) => {
      return {
        index: content.index,
        type: "text",
        title: content.title,
        fullMarkdown: convertLegacyContentToMarkdown(content),
      };
    }),
  };
  return v3;
};

export function handleGenerateArtifactToolCallChunk(toolCallChunkArgs: string) {
  let newArtifactText: ArtifactToolResponse | undefined = undefined;

  // Attempt to parse the tool call chunk.
  try {
    newArtifactText = parsePartialJson(toolCallChunkArgs);
    if (!newArtifactText) {
      throw new Error("Failed to parse new artifact text");
    }
    newArtifactText = {
      ...newArtifactText,
      title: newArtifactText.title ?? "",
    };
  } catch (_) {
    return "continue";
  }

  if (typeof newArtifactText.artifact === "string") {
    const content = createNewGeneratedArtifactFromTool(newArtifactText);
    if (!content) {
      return undefined;
    }
    content.fullMarkdown = cleanContent(content.fullMarkdown);

    return {
      currentIndex: 1,
      contents: [content],
    };
  }
}

type StreamChunkFields = {
  runId: string | undefined;
  event: string;
  langgraphNode: string;
  nodeInput: any | undefined;
  nodeChunk: any | undefined;
  nodeOutput: any | undefined;
  taskName: string | undefined;
};

export function extractChunkFields(
  chunk: Record<string, any> | undefined
): StreamChunkFields {
  if (!chunk || !chunk.data) {
    return {
      runId: undefined,
      event: "",
      langgraphNode: "",
      nodeInput: undefined,
      nodeChunk: undefined,
      nodeOutput: undefined,
      taskName: undefined,
    };
  }

  return {
    runId: chunk.data?.metadata?.run_id,
    event: chunk.data?.event || "",
    langgraphNode: chunk.data?.metadata?.langgraph_node || "",
    nodeInput: chunk.data?.data?.input,
    nodeChunk: chunk.data?.data?.chunk,
    nodeOutput: chunk.data?.data?.output,
    taskName: chunk.data?.name,
  };
}
