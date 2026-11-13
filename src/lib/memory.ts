import { sql } from "@/lib/db";
import { newId } from "@/lib/ids";

export type Memory = {
  id: string;
  content: string;
  created_at: string;
};

const MEMORY_LIMIT = 30;

/**
 * Save a new memory for a user.
 */
export async function saveMemory(stage: string, userSub: string, content: string): Promise<void> {
  const text = content.trim();
  if (!text || text.length > 500) return;
  
  await sql(
    "insert into user_memories (id, stage, user_sub, content) values ($1, $2, $3, $4)",
    [newId(), stage, userSub, text],
  );
}

/**
 * Get recent memories for a user (up to MEMORY_LIMIT).
 */
export async function getMemories(stage: string, userSub: string): Promise<Memory[]> {
  return sql<Memory>(
    `select id, content, created_at::text from user_memories
     where stage = $1 and user_sub = $2
     order by created_at desc
     limit $3`,
    [stage, userSub, MEMORY_LIMIT],
  );
}

/**
 * Delete a specific memory.
 */
export async function deleteMemory(stage: string, userSub: string, id: string): Promise<boolean> {
  const result = await sql(
    "delete from user_memories where id = $1 and stage = $2 and user_sub = $3 returning id",
    [id, stage, userSub],
  );
  return result.length > 0;
}

/**
 * Format memories for injection into system prompt.
 */
export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) return "";
  
  const items = memories
    .slice(0, MEMORY_LIMIT)
    .reverse() // oldest first for context
    .map((m, i) => `${i + 1}. ${m.content}`)
    .join("\n");
  
  return `\n\nRemembered facts about this person:\n${items}`;
}

/**
 * Detect if the user is asking to remember something.
 * Examples: "Remember that...", "My favourite is...", "I prefer..."
 */
export function shouldSaveMemory(text: string): boolean {
  const lower = text.toLowerCase().trim();
  
  // Explicit remember requests
  if (/\b(remember|don'?t forget|keep in mind|note that|save this)\b/.test(lower)) return true;
  
  // Preference statements
  if (/\b(my (favourite|favorite|preferred)|i (like|love|prefer|enjoy))\b/.test(lower)) {
    // But not questions
    if (/\?/.test(text)) return false;
    return true;
  }
  
  // Personal facts
  if (/\b(i am|i'?m|my name is|i run|i work)\b/.test(lower)) {
    if (/\?/.test(text)) return false;
    return true;
  }
  
  return false;
}

/**
 * Extract the memorable content from a user message.
 * Cleans up the "remember that" prefix if present.
 */
export function extractMemoryContent(text: string): string {
  let content = text.trim();
  
  // Remove common remember prefixes
  content = content.replace(/^(please\s+)?(remember|don'?t forget|keep in mind|note)\s+(that\s+)?/i, "");
  content = content.replace(/^(just\s+)?(fyi|for your information)[,:]?\s*/i, "");
  
  return content.trim();
}
