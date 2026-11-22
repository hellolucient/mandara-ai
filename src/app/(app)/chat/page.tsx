import { ChatPanel } from "@/components/chat-panel";
import { ChatOnlyPage } from "@/components/chat-app/chat-only-page";
import { DashboardChat } from "@/components/dashboard-chat";
import { usesChatOnlyView } from "@/lib/access";
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
    <DashboardChat conversations={conversations} activeId="" tab={mode}>
      <ChatPanel key={mode} conversationId="" conversationMode={mode} initialDraft={q} askId={ask} initialMessages={[]} modelOn={modelConfigured()} />
    </DashboardChat>
  );
}
