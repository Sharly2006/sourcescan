import React from 'react';
import { Shield, AlertCircle, Cpu, Lock, CheckCircle2, Calculator, Database } from 'lucide-react';

export default function About() {
  return (
    <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
          About SourceScan
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', marginTop: 4 }}>
          AI-Assisted Detection and Prioritisation of Potential Mosquito Breeding Sources.
        </p>
      </div>

      {/* Critical Scientific Limitation */}
      <div className="alert alert-warning" style={{ alignItems: 'flex-start' }}>
        <AlertCircle size={22} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ fontSize: '1rem', display: 'block', marginBottom: 4 }}>
            Scientific & Medical Limitation
          </strong>
          <p style={{ margin: 0, lineHeight: 1.5, fontSize: '0.9rem' }}>
            SourceScan is an <strong>AI-assisted screening and documentation tool</strong>, not a medical or public-health diagnostic system. 
            An image alone never proves mosquito breeding, confirms larvae, diagnoses disease, predicts an outbreak, or establishes that an area is safe.
            The application maintains a strict separation between computer vision detections, application heuristic scoring, and user-confirmed field observations.
          </p>
        </div>
      </div>

      {/* Problem & Proposed Solution */}
      <div className="card">
        <h2 className="card-title">Problem Statement & Purpose</h2>
        <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
          Mosquitoes breed in stagnant water collected in artificial and natural containers around households, balconies, terraces, gardens, and shared public spaces. Identifying these potential sources and keeping track of inspections can be challenging when observations are made manually and inconsistently.
        </p>
        <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          SourceScan assists users and environmental inspectors by automatically highlighting potential water-holding containers from photographs, providing a structured human-in-the-loop review workflow, and calculating a transparent, rule-based screening priority score.
        </p>
      </div>

      {/* Scoring Heuristic Formula */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Calculator size={20} color="var(--color-primary)" />
          <h2 className="card-title" style={{ margin: 0 }}>Transparent Rule-Based Scoring Formula</h2>
        </div>
        <p className="card-subtitle">
          The screening priority score is deterministic, unvalidated, and designed solely to assist manual prioritization.
        </p>

        <div style={{ background: 'var(--color-surface-muted)', padding: '16px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', marginBottom: 18, fontFamily: 'var(--font-mono)', fontSize: '0.92rem' }}>
          Final Score = max(0, Base Category Points + Water Adjustment + Cover Adjustment)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 14 }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: 8, color: 'var(--color-primary)' }}>1. Base Category Points</h4>
            <ul style={{ paddingLeft: 18, fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              <li><strong>Tyre, Bucket, Drum/Barrel, Water Tank, Cement Tub:</strong> 3 pts</li>
              <li><strong>Plant Pot / Saucer, Drip/AC Tray, Drain Inlet:</strong> 2 pts</li>
              <li><strong>Bottle, Coconut Shell, Other Containers:</strong> 1 pt</li>
            </ul>
          </div>

          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 14 }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: 8, color: 'var(--color-primary)' }}>2. Water Presence Adjustment</h4>
            <ul style={{ paddingLeft: 18, fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              <li><strong>Water Present (Confirmed):</strong> +4 pts</li>
              <li><strong>Water Uncertain:</strong> +2 pts</li>
              <li><strong>Water Absent (Confirmed):</strong> +0 pts</li>
              <li><strong>Unknown / Unassessed:</strong> 0 pts</li>
            </ul>
          </div>

          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 14 }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: 8, color: 'var(--color-primary)' }}>3. Covering Adjustment</h4>
            <ul style={{ paddingLeft: 18, fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              <li><strong>Uncovered:</strong> 0 pts</li>
              <li><strong>Tightly Covered (Confirmed):</strong> -2 pts</li>
              <li><strong>Unknown / Missing:</strong> 0 pts</li>
            </ul>
          </div>
        </div>

        <div style={{ marginTop: 18, padding: 12, backgroundColor: 'var(--color-surface-muted)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
          <strong>Screening Priority Bands:</strong> 0–3: <span style={{ color: 'var(--color-low)', fontWeight: 600 }}>Low Priority</span> • 4–6: <span style={{ color: 'var(--color-medium)', fontWeight: 600 }}>Medium Priority</span> • 7+: <span style={{ color: 'var(--color-high)', fontWeight: 600 }}>High Priority</span>
        </div>
      </div>

      {/* Privacy and Data Protection */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Lock size={20} color="var(--color-primary)" />
          <h2 className="card-title" style={{ margin: 0 }}>Privacy & Data Security</h2>
        </div>
        <ul style={{ paddingLeft: 20, color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.7 }}>
          <li><strong>EXIF & GPS Stripping:</strong> Uploaded images are re-encoded via Pillow and all GPS coordinates, camera serial numbers, and EXIF metadata are completely removed prior to storage.</li>
          <li><strong>UUID Filename Generation:</strong> User-supplied filenames are never stored directly on the filesystem to eliminate path traversal risks.</li>
          <li><strong>Local Persistence:</strong> All data is persisted in a local SQLite database with cascade foreign-key deletions.</li>
          <li><strong>Zero Location Tracking:</strong> Geographic coordinates are never requested, stored, or transmitted. Locality names are optional text labels.</li>
        </ul>
      </div>

      {/* System Architecture */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Cpu size={20} color="var(--color-primary)" />
          <h2 className="card-title" style={{ margin: 0 }}>Technology Architecture</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
          <div>
            <strong>Frontend:</strong> React, Vite, Lucide Icons, Custom CSS Design System
          </div>
          <div>
            <strong>Backend:</strong> Python 3.11, FastAPI, Uvicorn, Pydantic, Pillow
          </div>
          <div>
            <strong>Computer Vision:</strong> Ultralytics YOLO-World / YOLO11n
          </div>
          <div>
            <strong>Database & Tests:</strong> SQLite, Pytest with deterministic isolation
          </div>
        </div>
      </div>
    </div>
  );
}
