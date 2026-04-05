export default function ResultsPanel({ cards, results, onShare, onReset }) {
  if (!results) return null;

  return (
    <section className="impact-lab__results">
      <div className="impact-lab__section-head">
        <div>
          <p className="impact-lab__eyebrow">Results</p>
          <h3>Aftermath telemetry</h3>
        </div>
      </div>

      <div className="impact-lab__results-grid">
        {cards.map((card) => (
          <article key={card.id} className="impact-lab__result-card" style={{ '--result-tone': card.tone }}>
            <span className="impact-lab__result-icon">{card.icon}</span>
            <p className="impact-lab__result-title">{card.title}</p>
            <strong>{card.value}</strong>
            <p>{card.description}</p>
          </article>
        ))}
      </div>

      <div className="impact-lab__verdict" style={{ '--verdict-tone': results.verdict.color }}>
        <span>{results.verdict.emoji}</span>
        <div>
          <strong>{results.verdict.label}</strong>
          <p>{results.verdict.detail}</p>
        </div>
      </div>

      <div className="impact-lab__result-actions">
        <button type="button" className="impact-lab__ghost-button" onClick={onShare}>📤 Share This Impact</button>
        <button type="button" className="impact-lab__primary-button" onClick={onReset}>↺ Run New Simulation</button>
      </div>
    </section>
  );
}
