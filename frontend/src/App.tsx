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
type Mode = "create" | "join";
type Identity = { user_id: string; username: string };

const apiBaseUrl = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://gc-scorecard-api.onrender.com" : "")).replace(/\/$/, "");

function readSavedSession(): Session | null {
  try {
    const stored = localStorage.getItem("gc-scorecard-session");
    return stored ? (JSON.parse(stored) as Session) : null;
  } catch {
    return null;
  }
}
function readIdentity(): Identity | null {
  try {
    const stored = localStorage.getItem("gc-scorecard-identity");
    if (stored) return JSON.parse(stored) as Identity;
    const session = readSavedSession();
    return session ? { user_id: session.user_id, username: session.username } : null;
  } catch {
    return null;
  }
}
function getErrorMessage(response: Response, result: unknown): string {
  if (result && typeof result === "object" && "detail" in result && typeof result.detail === "string") return result.detail;
  if (response.status === 404) return "The scorecard API endpoint was not found. Check the backend deployment URL.";
  return `The server returned ${response.status}. Please try again.`;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(readSavedSession);
  const [identity, setIdentity] = useState<Identity | null>(readIdentity);
  const [mode, setMode] = useState<Mode>("create");
  const [username, setUsername] = useState(() => readIdentity()?.username ?? "");
  const [roomName, setRoomName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [setupError, setSetupError] = useState("");
  const [joining, setJoining] = useState(false);
  const chat = useChatWebSocket(session?.group_id ?? "", session?.user_id ?? "");

  async function enterRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJoining(true);
    setSetupError("");
    const name = username.trim();
    const savedIdentity = identity ?? { user_id: crypto.randomUUID(), username: name };
    try {
      const response = await fetch(`${apiBaseUrl}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: name,
          user_id: savedIdentity.user_id,
          ...(mode === "create" ? { group_name: roomName.trim() } : { group_id: roomId.trim() }),
        }),
      });
      let result: unknown;
      try { result = await response.json(); } catch { result = null; }
      if (!response.ok) throw new Error(getErrorMessage(response, result));
      const nextSession = result as Session;
      const nextIdentity = { user_id: nextSession.user_id, username: nextSession.username };
      localStorage.setItem("gc-scorecard-session", JSON.stringify(nextSession));
      localStorage.setItem("gc-scorecard-identity", JSON.stringify(nextIdentity));
      setIdentity(nextIdentity);
      setSession(nextSession);
    } catch (reason) {
      const message = reason instanceof TypeError
        ? "Could not reach the scorecard API. Check that the backend is deployed and VITE_API_URL is set."
        : reason instanceof Error ? reason.message : "Unable to connect to the server";
      setSetupError(message);
    } finally {
      setJoining(false);
    }
  }

  function leaveRoom() {
    localStorage.removeItem("gc-scorecard-session");
    setSession(null);
    setRoomName("");
    setRoomId("");
  }

  async function copyRoomCode() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.group_id);
    } catch {
      setSetupError("Clipboard access is unavailable. Copy the room code shown in the room header.");
    }
  }

  if (!session) {
    return (
      <main className="app-shell">
        <header className="glass-panel app-header">
          <div><p className="eyebrow">GROUP CHAT SCORECARD</p><h1>Make every message count.</h1></div>
        </header>
        <form className="glass-panel session-card" onSubmit={enterRoom}>
          <p className="eyebrow">GET STARTED</p>
          <h2>{mode === "create" ? "Create a room" : "Join a room"}</h2>
          <p className="muted">Keep your group chat lively and see everyone’s score update in real time.</p>
          <div className="session-modes" aria-label="Room action">
            <button type="button" aria-pressed={mode === "create"} onClick={() => { setMode("create"); setSetupError(""); }}>Create room</button>
            <button type="button" aria-pressed={mode === "join"} onClick={() => { setMode("join"); setSetupError(""); }}>Join room</button>
          </div>
          <label htmlFor="username">Your name</label>
          <input id="username" required maxLength={100} value={username} onChange={(e) => { setUsername(e.target.value); setIdentity((current) => current ? { ...current, username: e.target.value } : current); }} placeholder="e.g. Ada" autoComplete="nickname" />
          {mode === "create" ? (
            <>
              <label htmlFor="room-name">Room name</label>
              <input id="room-name" required maxLength={150} value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="e.g. Friday game night" />
            </>
          ) : (
            <>
              <label htmlFor="room-code">Room code</label>
              <input id="room-code" required value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Paste the room code" autoComplete="off" />
            </>
          )}
          {setupError && <p className="error-message" role="alert">{setupError}</p>}
          <button className="primary-action" type="submit" disabled={joining}>{joining ? "Connecting…" : mode === "create" ? "Create room" : "Join room"}</button>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="glass-panel app-header">
        <div>
          <p className="eyebrow">GROUP CHAT SCORECARD</p><h1>Make every message count.</h1>
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
        <aside className="sidebar"><Leaderboard scores={chat.scores} /><RulesModal /></aside>
      </section>
    </main>
  );
}
