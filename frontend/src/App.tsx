import { ChatRoom } from "./components/ChatRoom";
import { Leaderboard } from "./components/Leaderboard";
import { RulesModal } from "./components/RulesModal";
import { useChatWebSocket } from "./hooks/useChatWebSocket";

export default function App() {
  const roomId = "00000000-0000-0000-0000-000000000010";
  const userId = "00000000-0000-0000-0000-000000000001";
  const chat = useChatWebSocket(roomId, userId);

  return (
    <main className="app-shell">
      <header className="glass-panel app-header">
        <div>
          <p className="eyebrow">GROUP CHAT SCORECARD</p>
          <h1>Make every message count.</h1>
        </div>
        <button className="ghost-button" type="button" aria-label="Open scoring rules">
          Rules
        </button>
      </header>
      <section className="content-grid" aria-label="Group chat dashboard">
        <ChatRoom
          messages={chat.messages}
          connectionState={chat.connectionState}
          onSend={chat.sendEvent}
        />
        <aside className="sidebar">
        <Leaderboard scores={chat.scores} />
        <RulesModal />
        </aside>
      </section>
    </main>
  );
}
