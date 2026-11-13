import { useEffect, useState, type FormEvent } from "react";
import { ChatRoom } from "./components/ChatRoom";
import { GroupPhotoBackdrop } from "./components/GroupPhotoBackdrop";
import { Leaderboard } from "./components/Leaderboard";
import { RulesModal } from "./components/RulesModal";
import { members, type GroupMember } from "./config/membersConfig";
import { RESULTS_UNLOCK_DATE } from "./config/releaseConfig";
import { apiBaseUrl, backendIsConfigured } from "./config/api";
import { useChatWebSocket } from "./hooks/useChatWebSocket";

type Session = { user_id: string; username: string; group_id: string; group_name: string; access_token: string; member: GroupMember };
function readSession(): Session | null { try { const raw = localStorage.getItem("gc-scorecard-private-session"); return raw ? JSON.parse(raw) as Session : null; } catch { return null; } }

function PhotoAvatar({ member, onError, small = false }: { member: GroupMember; onError?: () => void; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <span className={`avatar-frame${small ? " small" : ""}`}>
    {failed ? <span className="avatar-monogram">{member.name.slice(0, 1)}</span> : <img className={`member-avatar crop-${member.id}`} src={member.avatar} alt={member.name} onError={() => { setFailed(true); onError?.(); }} />}
  </span>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(readSession);
  const [page, setPage] = useState<"landing" | "login">("landing");
  const [selected, setSelected] = useState<GroupMember | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const chat = useChatWebSocket(session?.group_id ?? "", session?.user_id ?? "", session?.access_token ?? "");
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const isScorecard = window.location.pathname === "/scorecard";
  const unlocked = Boolean(session?.member.role === "owner" || now >= RESULTS_UNLOCK_DATE.getTime());

  async function login(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError("");
    try {
      if (!backendIsConfigured) throw new Error("Backend is not connected. Set VITE_API_URL in the frontend deployment and redeploy.");
      const response = await fetch(`${apiBaseUrl}/api/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ member_id: selected.id, password }) });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.detail ?? `Backend login failed (${response.status})`);
      const next: Session = { ...body, member: selected }; localStorage.setItem("gc-scorecard-private-session", JSON.stringify(next)); setSession(next); setPassword("");
    } catch (e) { setError(e instanceof TypeError ? "Could not reach the backend. Check VITE_API_URL and the backend service status." : e instanceof Error ? e.message : "Could not sign in"); }
    finally { setBusy(false); }
  }
  function lock() { localStorage.removeItem("gc-scorecard-private-session"); setSession(null); setSelected(null); setPassword(""); setPage("login"); }
  const countdown = Math.max(0, RESULTS_UNLOCK_DATE.getTime() - now);
  const timeParts = [Math.floor(countdown / 86400000), Math.floor(countdown / 3600000) % 24, Math.floor(countdown / 60000) % 60, Math.floor(countdown / 1000) % 60];

  if (isScorecard) return <main className="app-shell scorecard-page"><GroupPhotoBackdrop blurred />{session && unlocked ? <div className="glass-panel scorecard-content"><header className="app-header"><div><p className="eyebrow">THE UNFILTERED HOOMANS</p><h1>Scorecard</h1></div><span className="access-badge">{session.member.role === "owner" ? "Owner Access — Live Standings" : "Live Standings"}</span><a className="ghost-button" href="/">← Group chat</a></header><div className="content-grid"><Leaderboard scores={chat.scores} /><RulesModal /></div></div> : session ? <section className="glass-panel lock-card"><p className="eyebrow">SCORECARD LOCKED</p><h1>Standings reveal soon.</h1><p className="muted">Your group’s scorecard unlocks at</p><strong>{RESULTS_UNLOCK_DATE.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}</strong><div className="countdown">{timeParts.map((n, i) => <span key={i}>{String(n).padStart(2, "0")}{i < 3 ? " : " : ""}</span>)}</div><a className="ghost-button" href="/">Back to chat</a></section> : <AuthGate onLogin={(m) => { setSelected(m); setPage("login"); }} />}</main>;

  if (session) return <main className="app-shell chat-page"><div className="chat-love-backdrop" aria-hidden="true" /><header className="glass-panel app-header"><div className="signed-member"><PhotoAvatar member={session.member} small /><div><p className="eyebrow">THE UNFILTERED HOOMANS {session.member.role === "owner" && <b className="owner-badge">OWNER</b>}</p></div></div><nav className="header-actions"><a className="ghost-button" href="/scorecard" target="_blank" rel="noopener noreferrer">Open Scorecard ↗</a><button className="ghost-button" onClick={lock}>Switch Avatar / Lock</button></nav></header><ChatRoom messages={chat.messages} connectionState={chat.connectionState} serverError={chat.serverError} onSend={chat.sendEvent} typingNames={chat.typingNames} isOwner={session.member.role === "owner"} onTyping={chat.sendTyping} /><div className="sr-only"><RulesModal /></div></main>;

  return <main className="app-shell auth-page"><GroupPhotoBackdrop blurred={page === "login"} />{page === "landing" ? <section className="glass-panel hero-card"><h1>The unfiltered hoomans.</h1><button className="primary-action" onClick={() => setPage("login")}>Enter Your Avatar</button></section> : <section className="glass-panel login-card"><button className="back-link" onClick={() => { setSelected(null); setPage("landing"); }}>← Back</button><p className="eyebrow">PRIVATE GROUP</p><h1>Choose your avatar</h1>{selected ? <form onSubmit={login} className="selected-login"><PhotoAvatar member={selected} /><strong>{selected.name}</strong><div className="password-row"><input type={showPassword ? "text" : "password"} autoFocus autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button><button className="primary-action" disabled={busy || !password} aria-label="Sign in">{busy ? "…" : "→"}</button></div>{error && <p className="error-message">{error}</p>}<button type="button" className="back-link" onClick={() => { setSelected(null); setPassword(""); setShowPassword(false); setError(""); }}>Back to all avatars</button></form> : <div className="member-grid">{members.map((m) => <button className="member-choice" key={m.id} onClick={() => { setSelected(m); setError(""); }}><PhotoAvatar member={m} /><span>{m.name}</span></button>)}</div>}</section>}</main>;
}

function AuthGate({ onLogin }: { onLogin: (member: GroupMember) => void }) { return <section className="glass-panel lock-card"><p className="eyebrow">PRIVATE GROUP</p><h1>Sign in to view your scorecard</h1><a className="ghost-button" href="/">Return to login</a></section>; }
