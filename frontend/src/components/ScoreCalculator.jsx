import React from 'react';
import PriorityBadge from './PriorityBadge';
import { Calculator, ArrowRight, ShieldCheck } from 'lucide-react';

export default function ScoreCalculator({
  containerType = 'other',
  waterStatus = 'uncertain',
  covered = false,
  baseScores = {},
  actions = {},
}) {
  const normType = (containerType || 'other').trim().toLowerCase();
  const base = baseScores[normType] ?? 1;

  let waterMod = 2;
  if (waterStatus === 'present') waterMod = 4;
  else if (waterStatus === 'absent') waterMod = 0;
  else if (waterStatus === 'uncertain') waterMod = 2;
  else if (waterStatus === 'unknown') waterMod = 0;

  const coverMod = covered ? -2 : 0;
  const rawScore = base + waterMod + coverMod;
  const finalScore = Math.max(0, rawScore);

  let category = 'Low';
  if (finalScore >= 7) category = 'High';
  else if (finalScore >= 4) category = 'Medium';

  const action = actions[normType] || 'Inspect container and empty any stagnant water.';

  return (
    <div style={{ background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-md)', padding: 16, border: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-primary)' }}>
          <Calculator size={16} />
          <span>Screening Priority Calculator</span>
        </div>
        <PriorityBadge category={category} score={finalScore} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.88rem', background: 'var(--color-surface)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-strong)' }}>
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>Base ({containerType || 'other'}):</span>{' '}
          <strong style={{ color: 'var(--color-text-main)' }}>+{base}</strong>
        </div>
        <span style={{ color: 'var(--color-primary)' }}>+</span>
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>Water ({waterStatus}):</span>{' '}
          <strong style={{ color: 'var(--color-text-main)' }}>+{waterMod}</strong>
        </div>
        <span style={{ color: 'var(--color-primary)' }}>+</span>
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>Cover ({covered ? 'tightly covered' : 'uncovered'}):</span>{' '}
          <strong style={{ color: 'var(--color-text-main)' }}>{coverMod}</strong>
        </div>
        <ArrowRight size={14} style={{ color: 'var(--color-text-light)' }} />
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>Score:</span>{' '}
          <strong style={{ fontSize: '1.1rem', color: category === 'High' ? 'var(--color-high)' : category === 'Medium' ? 'var(--color-medium)' : 'var(--color-low)' }}>
            {finalScore}
          </strong>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: '0.86rem', color: 'var(--color-text-main)', lineHeight: 1.4 }}>
        <strong style={{ color: 'var(--color-primary)' }}>Recommended Action:</strong>{' '}
        <span style={{ color: 'var(--color-text-muted)' }}>{action}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: '0.76rem', color: 'var(--color-text-light)' }}>
        *Heuristic screening score only; not an epidemiological prediction or disease diagnosis.
      </div>
    </div>
  );
}
