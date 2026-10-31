import { useEffect, useState } from "react";

type ScoringRule = { action: string; points: number; description?: string };

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function RulesModal() {
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/scoring-rules`)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load scoring rules");
        return response.json() as Promise<ScoringRule[]>;
      })
      .then(setRules)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <section className="glass-panel placeholder-panel" aria-labelledby="rules-title">
      <p className="eyebrow">CONFIGURATION</p>
      <h2 id="rules-title">RulesModal</h2>
      {error ? <p role="alert" className="muted">{error}</p> : (
        <ul className="rules-list">
          {rules.map((rule) => (
            <li key={rule.action}>
              <span>{rule.description ?? rule.action}</span>
              <strong>{rule.points}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
