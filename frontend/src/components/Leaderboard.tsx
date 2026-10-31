import type { LiveScore } from "../hooks/useChatWebSocket";

export function Leaderboard({ scores }: { scores: LiveScore[] }) {
  return (
    <section className="glass-panel placeholder-panel" aria-labelledby="leaderboard-title">
      <p className="eyebrow">LIVE SCORES</p>
      <h2 id="leaderboard-title">Leaderboard</h2>
      {scores.length === 0 ? (
        <p className="muted">Scores will appear as the room gets active.</p>
      ) : (
        <ol className="score-list">
          {scores.map((score, index) => (
            <li key={score.user_id}>
              <span><b>#{index + 1}</b> {score.username}</span>
              <strong>{score.points}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
