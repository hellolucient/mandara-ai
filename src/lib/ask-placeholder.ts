export type AskMode = "mandara" | "general";

export const MANDARA_ASK_PLACEHOLDER = "How did Hakuraa do yesterday?";
export const GENERAL_ASK_PLACEHOLDER = "What's the weather in Malé?";

export function askPlaceholder(mode: AskMode): string {
  return mode === "general" ? GENERAL_ASK_PLACEHOLDER : MANDARA_ASK_PLACEHOLDER;
}
