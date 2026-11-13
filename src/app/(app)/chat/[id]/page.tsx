import { ChatPanel } from "@/components/chat-panel";
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
  return (
    <div className="md:flex md:min-h-screen">
      <ConversationList items={conversations} activeId={id} />
      <div className="min-w-0 flex-1">
        <ChatPanel conversationId={id} initialMessages={conversation.messages} modelOn={modelConfigured()} />
      </div>
    </div>
  );
}
