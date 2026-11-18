import { ChatApp } from "@/components/chat-app/chat-app";
import type { ChatMessage } from "@/components/chat-panel";
import { roleLabel } from "@/lib/access";
import { chatSuggestions, greeting, initials } from "@/lib/chat-view";
import type { Member } from "@/lib/members";
import { modelConfigured } from "@/lib/openrouter";
import { authMode } from "@/lib/session";

/** Server wrapper: everything the chat-only screen needs, read on the server. */
export function ChatOnlyPage({
  member,
  conversations,
  conversationId = "",
  messages = [],
  initialDraft = "",
}: {
  member: Member;
  conversations: Array<{ id: string; title: string; updated_at?: string; mode?: string }>;
  conversationId?: string;
  messages?: ChatMessage[];
  initialDraft?: string;
}) {
  const name = member.name?.replace(/\s*\([^)]*\)\s*/g, " ").trim() || "Mandara team";
  return (
    <ChatApp
      conversationId={conversationId}
      conversations={conversations}
      initialMessages={messages}
      user={{ name, initials: initials(name), roleLabel: roleLabel(member.role) }}
      greeting={greeting(member.name ?? "", new Date())}
      suggestions={chatSuggestions()}
      modelOn={modelConfigured()}
      localAuth={authMode() === "local"}
      initialDraft={initialDraft}
    />
  );
}
