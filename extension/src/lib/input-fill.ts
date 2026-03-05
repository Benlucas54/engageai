import type { Platform } from "./types";

/**
 * Fills a reply input element with text without submitting.
 * Handles textarea (React/native) and contenteditable (Lexical/Threads) inputs.
 */
export function fillReplyInput(
  input: HTMLElement,
  text: string,
  platform: Platform
): void {
  if (input instanceof HTMLTextAreaElement) {
    fillTextarea(input, text);
  } else if (input.isContentEditable) {
    fillContentEditable(input, text);
  }
}

function fillTextarea(textarea: HTMLTextAreaElement, text: string): void {
  // Use native setter to bypass React's synthetic event system
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(textarea, text);
  } else {
    textarea.value = text;
  }
  textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillContentEditable(el: HTMLElement, text: string): void {
  el.focus();
  // Select all existing content and replace
  document.execCommand("selectAll");
  document.execCommand("delete");
  document.execCommand("insertText", false, text);
  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
}
