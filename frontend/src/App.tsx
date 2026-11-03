import { useState, type FormEvent } from "react";
import { ChatRoom } from "./components/ChatRoom";
import { Leaderboard } from "./components/Leaderboard";
import { RulesModal } from "./components/RulesModal";
import { useChatWebSocket } from "./hooks/useChatWebSocket";

type Session = {
  user_id: string;
  username: string;
  group_id: string;
  group_name: string;
};

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

function readSavedSession(): Session | null {
  try {
    const stored = localStorage.getItem("gc-scorecard-session");
    return stored ? (JSON.parse(stored) as Session) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(readSavedSession);
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [setupError, setSetupError] = useState("");
  const [joining, setJoining] = useState(false);
  const chat = useChatWebSocket(session?.group_id ?? "", session?.user_id ?? "");

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJoining(true);
    setSetupError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), group_id: roomId.trim() || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Unable to join the room");
      const nextSession = result as Session;
      localStorage.setItem("gc-scorecard-session", JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (reason) {
      setSetupError(reason instanceof Error ? reason.message : "Unable to connect to the server");
    } finally {
      setJoining(false);
    }
  }

  function leaveRoom() {
    localStorage.removeItem("gc-scorecard-session");
    setSession(null);
    setUsername("");
    setRoomId("");
  }

  async function copyRoomCode() {
    if (session) {
      try {
        await navigator.clipboard.writeText(session.group_id);
      } catch {
        setSetupError("Clipboard access is unavailable. Copy the room code from the address below.");
      }
    }
  }

  if (!session) {
    return (
      <main className="app-shell">
        <header className="glass-panel app-header">
          <div>
            <p className="eyebrow">GROUP CHAT SCORECARD</p>
            <h1>Make every message count.</h1>
          </div>
        </header>
        <form className="glass-panel session-card" onSubmit={joinRoom}>
          <p className="eyebrow">GET STARTED</p>
          <h2>Join your group chat</h2>
          <p className="muted">Create a room or enter a room code shared by a teammate.</p>
          <label htmlFor="username">Your name</label>
          <input id="username" required maxLength={100} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. Ada" />
          <label htmlFor="room-code">Room code <span className="muted">(leave blank to create a room)</span></label>
          <input id="room-code" value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Paste a room code" />
          {setupError && <p className="error-message" role="alert">{setupError}</p>}
          <button type="submit" disabled={joining}>{joining ? "Connecting…" : roomId.trim() ? "Join room" : "Create room"}</button>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="glass-panel app-header">
        <div>
          <p className="eyebrow">GROUP CHAT SCORECARD</p>
          <h1>Make every message count.</h1>
          <p className="room-meta">Room: {session.group_name} · Signed in as {session.username}</p>
          <p className="room-code">Room code: <code>{session.group_id}</code></p>
        </div>
        <div className="header-actions">
          <button className="ghost-button" type="button" onClick={() => document.getElementById("scoring-rules")?.scrollIntoView({ behavior: "smooth" })}>Scoring rules</button>
          <button className="ghost-button" type="button" onClick={copyRoomCode}>Copy room code</button>
          <button className="ghost-button" type="button" onClick={leaveRoom}>Switch room</button>
        </div>
      </header>
      {setupError && <p className="error-message" role="alert">{setupError}</p>}
      <section className="content-grid" aria-label="Group chat dashboard">
        <ChatRoom messages={chat.messages} connectionState={chat.connectionState} serverError={chat.serverError} onSend={chat.sendEvent} />
        <aside className="sidebar">
          <Leaderboard scores={chat.scores} />
          <RulesModal />
        </aside>
      </section>
    </main>
  );
}
