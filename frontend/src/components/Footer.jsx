import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        {/* Scientific disclaimer */}
        <div className="footer-disclaimer">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontWeight: 700, color: 'var(--color-primary)',
            marginBottom: 6, fontSize: '0.82rem', letterSpacing: '0.02em',
          }}>
            <AlertCircle size={14} />
            <span>Scientific &amp; Screening Notice</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
            SourceScan is an independent software tool for preliminary screening and documentation of
            potential water-holding containers. It does not diagnose vector-borne diseases, detect
            mosquito larvae or eggs, prove breeding activity, or replace official municipal health
            inspection and vector control protocols.
          </p>
        </div>

        {/* Bottom row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: 10,
        }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            <strong style={{ color: 'var(--color-text-main)' }}>SourceScan</strong>
            {' '}— AI-Assisted Mosquito Breeding Source Screening Prototype.
          </p>
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-light)' }}>
            Transparent heuristic scoring&nbsp;·&nbsp;Local inference&nbsp;·&nbsp;Privacy by design
          </p>
        </div>
      </div>
    </footer>
  );
}
