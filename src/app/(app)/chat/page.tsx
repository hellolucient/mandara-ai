import { ChatPanel } from "@/components/chat-panel";
import { ConversationList } from "@/components/conversation-list";
import { listConversations } from "@/lib/chat";
import { modelConfigured } from "@/lib/openrouter";
import { currentMember } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const member = await currentMember();
  if (!member) redirect("/");
  const conversations = await listConversations(member);
  return (
    <div className="md:flex md:min-h-screen">
      <ConversationList items={conversations} activeId="" />
      <div className="min-w-0 flex-1">
        <ChatPanel conversationId="" initialMessages={[]} modelOn={modelConfigured()} />
      </div>
    </div>
  );
}
