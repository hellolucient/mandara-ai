import { ChatPanel } from "@/components/chat-panel";
import { ChatOnlyPage } from "@/components/chat-app/chat-only-page";
import { usesChatOnlyView } from "@/lib/access";
import { ConversationList } from "@/components/conversation-list";
import { getConversation, listConversations } from "@/lib/chat";
import { modelConfigured } from "@/lib/openrouter";
import { currentMember } from "@/lib/session";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const member = await currentMember();
  if (!member) redirect("/");
  const { id } = await params;
  const [conversation, conversations] = await Promise.all([
    getConversation(member, id),
    listConversations(member),
  ]);
  if (!conversation) notFound();
  if (usesChatOnlyView(member)) {
    return <ChatOnlyPage member={member} conversations={conversations} conversationId={id} messages={conversation.messages} />;
  }
  return (
    <div className="md:flex md:min-h-screen">
      <ConversationList items={conversations} activeId={id} />
      <div className="min-w-0 flex-1">
        <ChatPanel
          conversationId={id}
          conversationMode={conversation.mode || "general"}
          initialMessages={conversation.messages}
          modelOn={modelConfigured()}
        />
      </div>
    </div>
  );
}
