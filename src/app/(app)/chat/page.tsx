import { ChatPanel } from "@/components/chat-panel";
import { ChatOnlyPage } from "@/components/chat-app/chat-only-page";
import { usesChatOnlyView } from "@/lib/access";
import { ConversationList } from "@/components/conversation-list";
import { listConversations } from "@/lib/chat";
import { modelConfigured } from "@/lib/openrouter";
import { currentMember } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; mode?: string | string[] }>;
}) {
  const member = await currentMember();
  if (!member) redirect("/");
  // Home's "Ask Mandara AI" tile links here with ?q=…&mode=…; prefill the composer, never auto-send.
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 2000) : "";
  const mode = params.mode === "mandara" || params.mode === "general" ? params.mode : "general";
  const conversations = await listConversations(member);
  if (usesChatOnlyView(member)) return <ChatOnlyPage member={member} conversations={conversations} initialDraft={q} />;
  return (
    <div className="md:flex md:min-h-screen">
      <ConversationList items={conversations} activeId="" />
      <div className="min-w-0 flex-1">
        <ChatPanel conversationId="" conversationMode={mode} initialDraft={q} initialMessages={[]} modelOn={modelConfigured()} />
      </div>
    </div>
  );
}
