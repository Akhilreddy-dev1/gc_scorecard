import { useEffect, useState } from "react";

type ScoringRule = { action: string; points: number; description?: string };

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

export function RulesModal() {
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/api/scoring-rules`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load scoring rules");
        return response.json() as Promise<ScoringRule[]>;
      })
      .then(setRules)
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="glass-panel placeholder-panel" id="scoring-rules" aria-labelledby="rules-title">
      <p className="eyebrow">CONFIGURATION</p>
      <h2 id="rules-title">Scoring rules</h2>
      {error ? <p role="alert" className="muted">{error}</p> : rules.length === 0 ? (
        <p className="muted">Loading scoring rules…</p>
      ) : (
        <ul className="rules-list">
          {rules.map((rule) => (
            <li key={rule.action}>
              <span>{rule.description ?? rule.action}</span>
              <strong>+{rule.points}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
