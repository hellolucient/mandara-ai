import { ChatPanel } from "@/components/chat-panel";
import { ChatOnlyPage } from "@/components/chat-app/chat-only-page";
import { DashboardChat } from "@/components/dashboard-chat";
import { usesChatOnlyView } from "@/lib/access";
import { getConversation, listConversations } from "@/lib/chat";
import { modelConfigured } from "@/lib/openrouter";
import { currentMember } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import type { ChatTab } from "@/lib/chat-view";

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
  const tab = (conversation.mode === "mandara" ? "mandara" : "general") as ChatTab;
  if (usesChatOnlyView(member)) {
    return <ChatOnlyPage member={member} conversations={conversations} conversationId={id} conversationMode={conversation.mode || "general"} messages={conversation.messages} />;
  }
  return (
    <DashboardChat conversations={conversations} activeId={id} tab={tab}>
      <ChatPanel
        conversationId={id}
        conversationMode={conversation.mode || "general"}
        initialMessages={conversation.messages}
        modelOn={modelConfigured()}
      />
    </DashboardChat>
  );
}
