import { ChatPanel } from "@/components/chat-panel";
import { ChatOnlyPage } from "@/components/chat-app/chat-only-page";
import { usesChatOnlyView } from "@/lib/access";
import { ConversationList } from "@/components/conversation-list";
import { listConversations } from "@/lib/chat";
import { parseHomeAsk } from "@/lib/home-ask";
import { modelConfigured } from "@/lib/openrouter";
import { currentMember } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; mode?: string | string[]; ask?: string | string[] }>;
}) {
  const member = await currentMember();
  if (!member) redirect("/");
  // Home's "Ask Mandara AI" tile links here with ?q=…&mode=…&ask=…; the chat auto-sends that question once.
  const { q, mode, ask } = parseHomeAsk(await searchParams);
  const conversations = await listConversations(member);
  if (usesChatOnlyView(member)) {
    return <ChatOnlyPage member={member} conversations={conversations} conversationMode={mode} initialDraft={q} askId={ask} />;
  }
  return (
    <div className="md:flex md:min-h-screen">
      <ConversationList items={conversations} activeId="" />
      <div className="min-w-0 flex-1">
        <ChatPanel key={mode} conversationId="" conversationMode={mode} initialDraft={q} askId={ask} initialMessages={[]} modelOn={modelConfigured()} />
      </div>
    </div>
  );
}
