import React, { useEffect, useState } from 'react';
import { fetchAnalytics, listInspections, getImageUrl } from '../api';
import PriorityBadge from '../components/PriorityBadge';
import {
  PlusCircle, AlertCircle, ArrowRight,
  Layers, MapPin, Calendar, Clock,
  Activity, TriangleAlert, ShieldCheck, ScanLine,
} from 'lucide-react';

/* ── helpers ─────────────────────────────── */
function fmt(date) {
  const d = new Date(date);
  return {
    date: d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
}
function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

/* ── Stat card ──────────────────────────── */
function StatCard({ icon, label, value, sub, accentColor, glowColor }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      boxShadow: 'var(--shadow-md)',
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = accentColor + '55';
        e.currentTarget.style.boxShadow = '0 0 20px ' + glowColor;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--color-border)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
    >
      {/* top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2, background: accentColor, opacity: 0.7,
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--color-text-light)',
        }}>{label}</span>
        <span style={{
          width: 32, height: 32, borderRadius: 8,
          background: accentColor + '18',
          border: '1px solid ' + accentColor + '30',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accentColor, flexShrink: 0,
        }}>{icon}</span>
      </div>

      <div style={{
        fontSize: '2.4rem', fontWeight: 900, lineHeight: 1,
        color: accentColor,
        textShadow: '0 0 24px ' + glowColor,
      }}>{value}</div>

      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>{sub}</div>
    </div>
  );
}

/* ── Main Dashboard ─────────────────────── */
export default function Dashboard({ setActivePage, onSelectInspection }) {
  const [analytics, setAnalytics]           = useState(null);
  const [recentInspections, setRecent]      = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [stats, inspections] = await Promise.all([
          fetchAnalytics(),
          listInspections(),
        ]);
        setAnalytics(stats);
        setRecent(inspections.slice(0, 5));
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* ── loading state ── */
  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '80px 20px', gap: 16,
        color: 'var(--color-text-muted)',
      }}>
        <ScanLine size={36} color="var(--color-primary)" style={{ opacity: 0.6 }} />
        <p style={{ fontSize: '0.95rem' }}>Loading dashboard…</p>
      </div>
    );
  }

  /* ── error state ── */
  if (error) {
    return (
      <div className="alert alert-danger" style={{ maxWidth: 560, margin: '48px auto' }}>
        <AlertCircle size={20} />
        <div><strong>Error loading data:</strong> {error}</div>
      </div>
    );
  }

  const total    = analytics?.total_inspections   || 0;
  const high     = analytics?.by_risk_category?.High   || 0;
  const medium   = analytics?.by_risk_category?.Medium || 0;
  const low      = analytics?.by_risk_category?.Low    || 0;
  const findings = analytics?.total_findings           || 0;
  const confirmed= analytics?.total_confirmed_findings || 0;
  const needsReview = high + medium;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Page header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--color-primary)',
              boxShadow: '0 0 8px rgba(52,211,153,0.7)',
              display: 'inline-block',
            }} />
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--color-text-light)',
            }}>Environmental Monitoring</span>
          </div>
          <h1 style={{
            fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900,
            color: 'var(--color-text-main)', lineHeight: 1.1, marginBottom: 6,
          }}>
            Inspection Dashboard
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem' }}>
            Overview of recorded screening events and risk priorities.
          </p>
        </div>

        <button
          onClick={() => setActivePage('new-inspection')}
          className="btn btn-primary"
          style={{ padding: '12px 24px', borderRadius: 'var(--radius-md)' }}
        >
          <PlusCircle size={17} />
          <span>New Inspection</span>
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
      }}>
        <StatCard
          icon={<Activity size={16} />}
          label="Total Inspections"
          value={total}
          sub="Recorded in local database"
          accentColor="#34d399"
          glowColor="rgba(52,211,153,0.15)"
        />
        <StatCard
          icon={<Layers size={16} />}
          label="Potential Sources"
          value={findings}
          sub={confirmed + ' user-confirmed'}
          accentColor="#818cf8"
          glowColor="rgba(129,140,248,0.12)"
        />
        <StatCard
          icon={<TriangleAlert size={16} />}
          label="Needs Closer Review"
          value={needsReview}
          sub={high + ' High · ' + medium + ' Medium priority'}
          accentColor={needsReview > 0 ? '#f87171' : '#34d399'}
          glowColor={needsReview > 0 ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.1)'}
        />
        <StatCard
          icon={<ShieldCheck size={16} />}
          label="Low / Cleared"
          value={low}
          sub="No significant water sources"
          accentColor="#fbbf24"
          glowColor="rgba(251,191,36,0.12)"
        />
      </div>

      {/* ── Priority distribution ── */}
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h2 className="card-title">Priority Distribution</h2>
            <p className="card-subtitle" style={{ marginBottom: 0 }}>
              Heuristic risk breakdown across all stored inspections.
            </p>
          </div>
          {total > 0 && (
            <span style={{
              fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em',
              color: 'var(--color-text-light)',
            }}>{total} TOTAL</span>
          )}
        </div>

        {total === 0 ? (
          <div style={{
            padding: '28px 0', textAlign: 'center',
            color: 'var(--color-text-light)', fontSize: '0.9rem',
          }}>
            No inspections yet — run your first screening to see distribution.
          </div>
        ) : (
          <>
            {/* Segmented bar */}
            <div style={{
              display: 'flex', height: 10, borderRadius: 'var(--radius-full)',
              overflow: 'hidden', background: 'var(--color-surface-muted)',
              border: '1px solid var(--color-border)', marginBottom: 20,
            }}>
              {high > 0 && (
                <div
                  title={'High: ' + high}
                  style={{
                    width: pct(high, total) + '%',
                    background: 'linear-gradient(90deg,#f87171,#ef4444)',
                    transition: 'width 0.6s ease',
                  }}
                />
              )}
              {medium > 0 && (
                <div
                  title={'Medium: ' + medium}
                  style={{
                    width: pct(medium, total) + '%',
                    background: 'linear-gradient(90deg,#fbbf24,#f59e0b)',
                    transition: 'width 0.6s ease',
                  }}
                />
              )}
              {low > 0 && (
                <div
                  title={'Low: ' + low}
                  style={{
                    width: pct(low, total) + '%',
                    background: 'linear-gradient(90deg,#34d399,#10b981)',
                    transition: 'width 0.6s ease',
                  }}
                />
              )}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'High Priority',   count: high,   color: '#f87171' },
                { label: 'Medium Priority', count: medium, color: '#fbbf24' },
                { label: 'Low Priority',    count: low,    color: '#34d399' },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: color, flexShrink: 0,
                    boxShadow: '0 0 6px ' + color + '88',
                  }} />
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {label}:{' '}
                    <strong style={{ color: 'var(--color-text-main)' }}>{count}</strong>
                    {' '}
                    <span style={{ color: 'var(--color-text-light)' }}>({pct(count, total)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Recent inspections ── */}
      <div className="card" style={{ padding: 0 }}>
        {/* Card header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 24px',
          borderBottom: recentInspections.length > 0 ? '1px solid var(--color-border)' : 'none',
        }}>
          <div>
            <h2 className="card-title" style={{ marginBottom: 2 }}>Recent Inspections</h2>
            <p className="card-subtitle" style={{ marginBottom: 0, fontSize: '0.82rem' }}>
              Latest recorded events from the local database.
            </p>
          </div>
          {total > 0 && (
            <button
              onClick={() => setActivePage('history')}
              className="btn btn-secondary btn-sm"
            >
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>

        {/* Empty state */}
        {recentInspections.length === 0 ? (
          <div style={{
            padding: '56px 24px',
            textAlign: 'center',
            background: 'radial-gradient(ellipse at center, rgba(52,211,153,0.04) 0%, transparent 70%)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(52,211,153,0.08)',
              border: '1px solid rgba(52,211,153,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <ScanLine size={26} color="var(--color-primary)" style={{ opacity: 0.7 }} />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8, color: 'var(--color-text-main)' }}>
              No Inspections Yet
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: 420, margin: '0 auto 22px' }}>
              Capture or upload a photo of a potential water-holding area to begin. SourceScan
              will analyse it for possible mosquito breeding sources.
            </p>
            <button
              onClick={() => setActivePage('new-inspection')}
              className="btn btn-primary"
            >
              <PlusCircle size={16} />
              <span>Start First Inspection</span>
            </button>
          </div>
        ) : (
          /* Inspections table */
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              textAlign: 'left', fontSize: '0.88rem',
            }}>
              <thead>
                <tr style={{
                  color: 'var(--color-text-light)',
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  {['Inspection', 'Date & Time', 'Locality', 'Priority', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '11px 16px',
                      fontWeight: 700, fontSize: '0.72rem',
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      textAlign: i === 4 ? 'right' : 'left',
                      background: 'var(--color-surface-muted)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentInspections.map((insp, idx) => {
                  const { date, time } = fmt(insp.created_at);
                  return (
                    <tr
                      key={insp.id}
                      style={{
                        borderBottom: idx < recentInspections.length - 1
                          ? '1px solid var(--color-border-subtle)' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-muted)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => onSelectInspection(insp.id)}
                    >
                      {/* ID + thumbnail */}
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                          {insp.image_ref ? (
                            <img
                              src={getImageUrl(insp.image_ref)}
                              alt="thumb"
                              style={{
                                width: 42, height: 42, objectFit: 'cover',
                                borderRadius: 6,
                                border: '1px solid var(--color-border)',
                              }}
                            />
                          ) : (
                            <div style={{
                              width: 42, height: 42,
                              background: 'var(--color-surface-muted)',
                              borderRadius: 6,
                              border: '1px solid var(--color-border)',
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--color-text-light)',
                              fontSize: '0.7rem',
                            }}>—</div>
                          )}
                          <span style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>
                            #{insp.id}
                          </span>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
                          <Calendar size={13} />
                          <span>{date}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--color-text-light)', marginTop: 3 }}>
                          <Clock size={11} />
                          <span>{time}</span>
                        </div>
                      </td>

                      {/* Locality */}
                      <td style={{ padding: '13px 16px', color: 'var(--color-text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={13} color="var(--color-text-light)" />
                          <span>{insp.locality || 'Unspecified'}</span>
                        </div>
                      </td>

                      {/* Priority badge */}
                      <td style={{ padding: '13px 16px' }}>
                        <PriorityBadge category={insp.overall_category} score={insp.overall_score} />
                      </td>

                      {/* Action */}
                      <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                        <button
                          onClick={e => { e.stopPropagation(); onSelectInspection(insp.id); }}
                          className="btn btn-secondary btn-sm"
                          aria-label={'View details for inspection ' + insp.id}
                        >
                          <span>Details</span>
                          <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
