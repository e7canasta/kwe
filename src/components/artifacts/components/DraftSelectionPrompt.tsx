import { Dispatch, FormEvent, forwardRef, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CircleArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraftSelectionPromptProps {
  isInputVisible: boolean;
  selectionBox: { top: number; left: number };
  setIsInputVisible: (visible: boolean) => void;
  handleSubmitMessage: (inputValue: string) => Promise<void>;
  handleSelectionBoxMouseDown: (e: React.MouseEvent) => void;
  handleCleanupState: () => void;
  inputValue: string;
  setInputValue: Dispatch<SetStateAction<string>>;
}

export const DraftSelectionPrompt = forwardRef<
  HTMLDivElement,
  DraftSelectionPromptProps
>(
  (props, ref) => {
    const {
      isInputVisible,
      selectionBox,
      inputValue,
      setInputValue,
      setIsInputVisible,
      handleSubmitMessage,
      handleSelectionBoxMouseDown,
    } = props;

    const handleSubmit = async (
      e:
        | FormEvent<HTMLFormElement>
        | React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
      e.preventDefault();
      if (selectionBox) {
        await handleSubmitMessage(inputValue);
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "absolute bg-white border border-gray-200 shadow-md p-2 flex gap-2",
          isInputVisible ? "rounded-3xl" : "rounded-md"
        )}
        style={{
          top: `${selectionBox.top + 65}px`,
          left: `${selectionBox.left}px`,
          width: isInputVisible ? "400px" : "250px",
          marginLeft: isInputVisible ? "0" : "150px",
        }}
        onMouseDown={handleSelectionBoxMouseDown}
      >
        {isInputVisible ? (
          <form
            onSubmit={handleSubmit}
            className="relative w-full overflow-hidden flex flex-row items-center gap-1"
          >
            <Input
              className="w-full transition-all duration-300 focus:ring-0 ease-in-out p-1 focus:outline-none border-0 focus-visible:ring-0"
              placeholder="Ask drafting assistant..."
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <Button
              onClick={(e) => handleSubmit(e)}
              type="submit"
              variant="ghost"
              size="icon"
            >
              <CircleArrowUp
                className="cursor-pointer"
                fill="black"
                stroke="white"
                size={30}
              />
            </Button>
          </form>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setIsInputVisible(true)}
            className="transition-all duration-300 ease-in-out w-full"
          >
            Ask Drafter
          </Button>
        )}
      </div>
    );
  }
);

DraftSelectionPrompt.displayName = "DraftSelectionPrompt";
