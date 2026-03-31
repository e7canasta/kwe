import { convertToOpenAIFormat } from "@/lib/convert_messages";
import { HumanMessage } from "@langchain/core/messages";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ActionsToolbar } from "./actions_toolbar";
import { TextRenderer } from "./TextRenderer";
import { getArtifactContent } from "@opencanvas/shared/utils/artifacts";
import { ArtifactLoading } from "./ArtifactLoading";
import { DraftSelectionPrompt } from "./components/DraftSelectionPrompt";
import { useGraphContext } from "@/contexts/GraphContext";
import { ArtifactHeader } from "./header";

export interface ArtifactRendererProps {
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  chatCollapsed: boolean;
  setChatCollapsed: (c: boolean) => void;
}

interface SelectionBox {
  top: number;
  left: number;
  text: string;
}

function ArtifactRendererComponent(props: ArtifactRendererProps) {
  const { graphData } = useGraphContext();
  const {
    artifact,
    selectedBlocks,
    isStreaming,
    isArtifactSaved,
    artifactUpdateFailed,
    setSelectedArtifact,
    setMessages,
    streamMessage,
    setSelectedBlocks,
  } = graphData;
  const artifactContentRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const selectionBoxRef = useRef<HTMLDivElement>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox>();
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isHoveringOverArtifact, setIsHoveringOverArtifact] = useState(false);
  const [isValidSelectionOrigin, setIsValidSelectionOrigin] = useState(false);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentRef.current) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString().trim();

      // Check if the selection originated from within the artifact content
      if (selectedText && artifactContentRef.current) {
        const isWithinArtifact = (node: Node | null): boolean => {
          if (!node) return false;
          if (node === artifactContentRef.current) return true;
          return isWithinArtifact(node.parentNode);
        };

        // Check both start and end containers
        const startInArtifact = isWithinArtifact(range.startContainer);
        const endInArtifact = isWithinArtifact(range.endContainer);

        if (startInArtifact && endInArtifact) {
          setIsValidSelectionOrigin(true);
          const rects = range.getClientRects();
          const firstRect = rects[0];
          const lastRect = rects[rects.length - 1];
          const contentRect = contentRef.current.getBoundingClientRect();

          const boxWidth = 400; // Approximate width of the selection box
          let left = lastRect.right - contentRect.left - boxWidth;

          if (left < 0) {
            left = Math.min(0, firstRect.left - contentRect.left);
          }
          // Ensure the box doesn't go beyond the left edge
          if (left < 0) {
            left = Math.min(0, firstRect.left - contentRect.left);
          }

          setSelectionBox({
            top: lastRect.bottom - contentRect.top,
            left: left,
            text: selectedText,
          });
          setIsInputVisible(false);
          setIsSelectionActive(true);
        } else {
          setIsValidSelectionOrigin(false);
          handleCleanupState();
        }
      }
    }
  }, []);

  const handleCleanupState = () => {
    setIsInputVisible(false);
    setSelectionBox(undefined);
    setIsSelectionActive(false);
    setIsValidSelectionOrigin(false);
    setInputValue("");
  };

  const handleDocumentMouseDown = useCallback(
    (event: MouseEvent) => {
      if (
        isSelectionActive &&
        selectionBoxRef.current &&
        !selectionBoxRef.current.contains(event.target as Node)
      ) {
        handleCleanupState();
      }
    },
    [isSelectionActive]
  );

  const handleSelectionBoxMouseDown = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  const handleSubmit = async (content: string) => {
    const humanMessage = new HumanMessage({
      content,
      id: uuidv4(),
    });

    setMessages((prevMessages) => [...prevMessages, humanMessage]);
    handleCleanupState();
    await streamMessage({
      messages: [convertToOpenAIFormat(humanMessage)],
    });
  };

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [handleMouseUp, handleDocumentMouseDown]);

  useEffect(() => {
    try {
      if (artifactContentRef.current && highlightLayerRef.current) {
        const content = artifactContentRef.current;
        const highlightLayer = highlightLayerRef.current;

        // Clear existing highlights
        highlightLayer.innerHTML = "";

        if (isSelectionActive && selectionBox) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            if (content.contains(range.commonAncestorContainer)) {
              const rects = range.getClientRects();
              const layerRect = highlightLayer.getBoundingClientRect();

              // For markdown artifacts, we don't need exact character indexes
              // Text selection is handled by the browser

              for (let i = 0; i < rects.length; i++) {
                const rect = rects[i];
                const highlightEl = document.createElement("div");
                highlightEl.className =
                  "absolute bg-[#3597934d] pointer-events-none";

                // Adjust the positioning and size
                const verticalPadding = 3;
                highlightEl.style.left = `${rect.left - layerRect.left}px`;
                highlightEl.style.top = `${rect.top - layerRect.top - verticalPadding}px`;
                highlightEl.style.width = `${rect.width}px`;
                highlightEl.style.height = `${rect.height + verticalPadding * 2}px`;

                highlightLayer.appendChild(highlightEl);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to get artifact selection", e);
    }
  }, [isSelectionActive, selectionBox]);

  useEffect(() => {
    if (!!selectedBlocks && !isSelectionActive) {
      // Selection is not active but selected blocks are present. Clear them.
      setSelectedBlocks(undefined);
    }
  }, [isSelectionActive, selectedBlocks, setSelectedBlocks]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if we're in an input/textarea element
      const activeElement = document.activeElement;
      const isInputActive =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement;

      // If selection states are active and we're not in an input field
      if (
        (isInputVisible || selectionBox || isSelectionActive) &&
        !isInputActive
      ) {
        // Check if the key is a character key or backspace/delete
        if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") {
          handleCleanupState();
        }
      }

      // Handle escape key for input box
      if ((isInputVisible || isSelectionActive) && e.key === "Escape") {
        handleCleanupState();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isInputVisible, selectionBox, isSelectionActive]);

  const currentArtifactContent = artifact
    ? getArtifactContent(artifact)
    : undefined;

  if (!artifact && isStreaming) {
    return <ArtifactLoading />;
  }

  if (!artifact || !currentArtifactContent) {
    return <div className="w-full h-full"></div>;
  }

  const isBackwardsDisabled =
    artifact.contents.length === 1 ||
    currentArtifactContent.index === 1 ||
    isStreaming;
  const isForwardDisabled =
    artifact.contents.length === 1 ||
    currentArtifactContent.index === artifact.contents.length ||
    isStreaming;

  return (
    <div className="relative w-full h-full max-h-screen overflow-auto">
      <ArtifactHeader
        isArtifactSaved={isArtifactSaved}
        isBackwardsDisabled={isBackwardsDisabled}
        isForwardDisabled={isForwardDisabled}
        setSelectedArtifact={setSelectedArtifact}
        currentArtifactContent={currentArtifactContent}
        totalArtifactVersions={artifact.contents.length}
        artifactUpdateFailed={artifactUpdateFailed}
        chatCollapsed={props.chatCollapsed}
        setChatCollapsed={props.setChatCollapsed}
      />
      <div ref={contentRef} className="flex justify-center h-full">
        <div className="relative min-h-full min-w-full">
          <div
            className="h-full"
            ref={artifactContentRef}
            onMouseEnter={() => setIsHoveringOverArtifact(true)}
            onMouseLeave={() => setIsHoveringOverArtifact(false)}
          >
            <TextRenderer
              isInputVisible={isInputVisible}
              isEditing={props.isEditing}
              isHovering={isHoveringOverArtifact}
            />
          </div>
          <div
            ref={highlightLayerRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
        </div>
        {selectionBox && isSelectionActive && isValidSelectionOrigin && (
          <DraftSelectionPrompt
            ref={selectionBoxRef}
            inputValue={inputValue}
            setInputValue={setInputValue}
            isInputVisible={isInputVisible}
            selectionBox={selectionBox}
            setIsInputVisible={setIsInputVisible}
            handleSubmitMessage={handleSubmit}
            handleSelectionBoxMouseDown={handleSelectionBoxMouseDown}
            handleCleanupState={handleCleanupState}
          />
        )}
      </div>
      <ActionsToolbar
        isTextSelected={isSelectionActive || selectedBlocks !== undefined}
      />
    </div>
  );
}

export const ArtifactRenderer = React.memo(ArtifactRendererComponent);
