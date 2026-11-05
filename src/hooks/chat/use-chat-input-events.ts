import { useCallback } from "react";
import {
  ensureCursorVisible,
  clearEmptyContent,
  getClipboardFiles,
} from "#/components/features/chat/utils/chat-input.utils";

/**
 * Hook for handling chat input events
 */
export const useChatInputEvents = (
  chatInputRef: React.RefObject<HTMLDivElement | null>,
  smartResize: () => void,
  increaseHeightForEmptyContent: () => void,
  checkIsContentEmpty: () => boolean,
  onFocus?: () => void,
  onBlur?: () => void,
) => {
  // Handle input events
  const handleInput = useCallback(() => {
    smartResize();

    // Clear empty content to ensure placeholder shows
    if (chatInputRef.current) {
      clearEmptyContent(chatInputRef.current);
    }

    // Ensure cursor stays visible when content is scrollable
    ensureCursorVisible(chatInputRef.current);
  }, [smartResize, chatInputRef]);

  // Handle paste events to clean up formatting and handle files
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();

      const files = getClipboardFiles(e.clipboardData);
      const hasFiles = files.length > 0;

      if (hasFiles) {
        // Handle file paste - let the file handling system process the files
        // We'll trigger a custom event that the file handling system can listen to
        const customEvent = new CustomEvent("pasteFiles", {
          detail: { files },
        });
        document.dispatchEvent(customEvent);
        return;
      }

      // Handle text paste as before
      const text = e.clipboardData.getData("text/plain");
      if (text) {
        // Insert plain text
        document.execCommand("insertText", false, text);
        // Trigger resize
        setTimeout(smartResize, 0);
      }
    },
    [smartResize],
  );

  // Handle key events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, disabled: boolean, handleSubmit: () => void) => {
      if (e.key !== "Enter") {
        return;
      }

      // Ignore Enter key during IME composition (e.g., Chinese, Japanese, Korean input)
      // When using IME, Enter is used to confirm the composition, not to submit
      if (e.nativeEvent.isComposing) {
        return;
      }

      // Local convention: reserve Ctrl+Enter in the composer for sending,
      // including when empty/disabled, so it cannot also trigger Build plan.
      if (e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled && !checkIsContentEmpty()) {
          handleSubmit();
        }
        return;
      }

      if (checkIsContentEmpty()) {
        e.preventDefault();
        increaseHeightForEmptyContent();
        return;
      }

      // Enter and Shift+Enter retain the browser newline behavior.
    },
    [checkIsContentEmpty, increaseHeightForEmptyContent],
  );

  // Handle blur events to ensure placeholder shows when empty
  const handleBlur = useCallback(() => {
    // Clear empty content to ensure placeholder shows
    if (chatInputRef.current) {
      clearEmptyContent(chatInputRef.current);
    }

    // Call the original onBlur callback if provided
    if (onBlur) {
      onBlur();
    }
  }, [chatInputRef, onBlur]);

  // Handle focus events
  const handleFocus = useCallback(() => {
    if (onFocus) {
      onFocus();
    }
  }, [onFocus]);

  return {
    handleInput,
    handlePaste,
    handleKeyDown,
    handleBlur,
    handleFocus,
  };
};
