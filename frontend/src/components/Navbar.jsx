import React from 'react';
import { Shield, PlusCircle, History, Info, LayoutDashboard, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Navbar({ activePage, setActivePage, health }) {
  const isDemo = health?.detection?.mode === 'demo';

  return (
    <header className="header">
      <div className="header-inner">
        {/* Brand */}
        <button
          onClick={() => setActivePage('dashboard')}
          className="brand"
          style={{ cursor: 'pointer', border: 'none', background: 'transparent', padding: 0 }}
          aria-label="SourceScan home"
        >
          <div className="brand-icon">
            <Shield size={18} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <span style={{ display: 'block', lineHeight: 1.1 }}>SourceScan</span>
            <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 500, letterSpacing: '0.06em', color: 'var(--color-text-light)', textTransform: 'uppercase' }}>
              Environmental Screening
            </span>
          </div>
        </button>

        {/* Navigation */}
        <nav className="nav-links" aria-label="Main Navigation">
          <button onClick={() => setActivePage('dashboard')}
            className={'nav-item' + (activePage === 'dashboard' ? ' active' : '')}>
            <LayoutDashboard size={16} /><span>Dashboard</span>
          </button>
          <button onClick={() => setActivePage('new-inspection')}
            className={'nav-item' + (activePage === 'new-inspection' ? ' active' : '')}>
            <PlusCircle size={16} /><span>New Inspection</span>
          </button>
          <button onClick={() => setActivePage('history')}
            className={'nav-item' + (activePage === 'history' ? ' active' : '')}>
            <History size={16} /><span>History</span>
          </button>
          <button onClick={() => setActivePage('about')}
            className={'nav-item' + (activePage === 'about' ? ' active' : '')}>
            <Info size={16} /><span>About</span>
          </button>
        </nav>

        {/* Model status pill */}
        {health && (
          <div style={{ flexShrink: 0 }}>
            {isDemo ? (
              <span className="badge badge-neutral"
                title="Demo mode: prepared sample results. No model weights configured."
                style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <AlertTriangle size={12} color="var(--color-medium)" />
                <span>Demo Mode</span>
              </span>
            ) : (
              <span className="badge badge-low"
                title={'Active model: ' + health.detection.model_name + ' (' + health.detection.mode + ')'}
                style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <CheckCircle2 size={12} />
                <span>AI Active</span>
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

