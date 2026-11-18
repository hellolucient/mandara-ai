export type AskMode = "mandara" | "general";

export const MANDARA_ASK_PLACEHOLDER = "What would you like to know about Mandara today?";
export const GENERAL_ASK_PLACEHOLDER = "What's on your mind?";

export function askPlaceholder(mode: AskMode): string {
  return mode === "general" ? GENERAL_ASK_PLACEHOLDER : MANDARA_ASK_PLACEHOLDER;
}
