import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

export default function PriorityBadge({ category, score, showScore = true }) {
  const cat = (category || 'Low').toLowerCase();

  if (cat === 'high') {
    return (
      <span className="badge badge-high" title={`Priority: High (Score: ${score ?? '7+'})`}>
        <AlertCircle size={14} />
        <span>High Priority {showScore && score !== undefined ? `(${score})` : ''}</span>
      </span>
    );
  }

  if (cat === 'medium') {
    return (
      <span className="badge badge-medium" title={`Priority: Medium (Score: ${score ?? '4-6'})`}>
        <AlertTriangle size={14} />
        <span>Medium Priority {showScore && score !== undefined ? `(${score})` : ''}</span>
      </span>
    );
  }

  if (cat === 'low') {
    return (
      <span className="badge badge-low" title={`Priority: Low (Score: ${score ?? '0-3'})`}>
        <CheckCircle size={14} />
        <span>Low Priority {showScore && score !== undefined ? `(${score})` : ''}</span>
      </span>
    );
  }

  return (
    <span className="badge badge-neutral">
      <HelpCircle size={14} />
      <span>{category || 'Unassessed'}</span>
    </span>
  );
}
