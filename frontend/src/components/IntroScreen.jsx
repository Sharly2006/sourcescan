import React, { useEffect, useState, useRef, useCallback } from 'react';

/* ──────────────────────────────────────────────────────────
   Ambient generative audio via Web Audio API.
   Three detuned oscillators + LFO gives a soft breathing
   environmental tone. No external file. Silent fallback.
────────────────────────────────────────────────────────── */
function createAmbientAudio() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.connect(ctx.destination);

    const padGain = ctx.createGain();
    padGain.gain.value = 0.055;
    padGain.connect(master);

    const specs = [
      { type: 'sine',     freq: 55   },
      { type: 'sine',     freq: 82.4 },
      { type: 'triangle', freq: 110.2 },
    ];
    const oscs = specs.map(({ type, freq }) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(padGain);
      o.start();
      return o;
    });

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.011;
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    lfo.start();

    return {
      ctx,
      fadeIn() {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5);
      },
      fadeOut(cb) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
        setTimeout(() => {
          try { ctx.close(); } catch (_) {}
          if (cb) cb();
        }, 1350);
      },
      stop() {
        try {
          [...oscs, lfo].forEach((o) => o.stop());
          ctx.close();
        } catch (_) {}
      },
    };
  } catch (_) {
    return null;
  }
}

/* ──────────────────────────────────────────────────────────
   Particle canvas – emerald dots drifting upward.
────────────────────────────────────────────────────────── */
function ParticleCanvas({ reduced }) {
  const ref = useRef(null);

  useEffect(() => {
    if (reduced) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    let animId;
    const COUNT = window.innerWidth < 600 ? 38 : 72;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.17,
      vy: -(Math.random() * 0.14 + 0.03),
      a: Math.random() * 0.45 + 0.08,
    }));

    const draw = () => {
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pts) {
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx2d.fillStyle = 'rgba(52,211,153,' + p.a + ')';
        ctx2d.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [reduced]);

  if (reduced) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 1,
      }}
    />
  );
}

/* ──────────────────────────────────────────────────────────
   Inline SVG speaker icons (no extra dependency).
────────────────────────────────────────────────────────── */
function IconSoundOn() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function IconSoundOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────
   Main cinematic intro component.
   Props: onStartInspection() – navigates into the app.
          onSkipIntro()       – goes straight to dashboard.
────────────────────────────────────────────────────────── */
export default function IntroScreen({ onStartInspection, onSkipIntro }) {
  const [visible,     setVisible]     = useState(false);
  const [exiting,     setExiting]     = useState(false);
  const [soundOn,     setSoundOn]     = useState(false);
  const [soundAvail,  setSoundAvail]  = useState(true);
  const audioRef = useRef(null);

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Trigger CSS reveals after first paint
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.stop();
    };
  }, []);

  const handleSoundToggle = useCallback(() => {
    if (!soundAvail) return;
    if (!soundOn) {
      if (!audioRef.current) {
        const a = createAmbientAudio();
        if (!a) { setSoundAvail(false); return; }
        audioRef.current = a;
      }
      if (audioRef.current.ctx && audioRef.current.ctx.state === 'suspended') {
        audioRef.current.ctx.resume();
      }
      audioRef.current.fadeIn();
      setSoundOn(true);
    } else {
      audioRef.current.fadeOut(() => { audioRef.current = null; });
      setSoundOn(false);
    }
  }, [soundOn, soundAvail]);

  const handleEnter = useCallback(() => {
    setExiting(true);
    if (soundOn && audioRef.current) {
      audioRef.current.fadeOut(() => { audioRef.current = null; });
    }
    setTimeout(() => onStartInspection(), reduced ? 0 : 700);
  }, [soundOn, reduced, onStartInspection]);

  const handleSkip = useCallback(() => {
    setExiting(true);
    if (audioRef.current) audioRef.current.stop();
    setTimeout(() => onSkipIntro(), reduced ? 0 : 350);
  }, [reduced, onSkipIntro]);

  const rootCls = [
    'intro-root',
    visible ? 'intro-visible' : '',
    exiting ? 'intro-exiting' : '',
  ].filter(Boolean).join(' ');

  // Helper: adds intro-in when visible (triggers CSS transition)
  const revealCls = (base) => base + (visible ? ' intro-in' : '');

  return (
    <div className={rootCls} role="main" aria-label="SourceScan introduction">

      {/* ── Layered background ── */}
      <div className="intro-bg-base" aria-hidden="true" />
      <div className="intro-bg-radial intro-bg-radial-1" aria-hidden="true" />
      <div className="intro-bg-radial intro-bg-radial-2" aria-hidden="true" />
      <div className="intro-bg-grid"  aria-hidden="true" />
      {!reduced && <div className="intro-scan-line" aria-hidden="true" />}

      {/* ── Floating particles ── */}
      <ParticleCanvas reduced={reduced} />

      {/* ── Top-right controls ── */}
      <div className="intro-controls">
        {soundAvail && (
          <button
            className="intro-sound-btn"
            onClick={handleSoundToggle}
            aria-label={soundOn ? 'Mute ambient sound' : 'Enable ambient sound'}
            aria-pressed={soundOn}
          >
            {soundOn ? <IconSoundOn /> : <IconSoundOff />}
            <span>{soundOn ? 'SOUND ON' : 'SOUND OFF'}</span>
          </button>
        )}
        <button
          className="intro-skip-btn"
          onClick={handleSkip}
          aria-label="Skip introduction and go to dashboard"
        >
          Skip
        </button>
      </div>

      {/* ── Centre stage ── */}
      <div className="intro-centre">

        {/* Wordmark */}
        <div
          className={revealCls('intro-wordmark')}
          style={{ transitionDelay: '0.1s' }}
        >
          <span className="intro-wm-pip" aria-hidden="true" />
          SOURCESCAN
        </div>

        {/* Headline */}
        <h1
          className={revealCls('intro-headline')}
          style={{ transitionDelay: '0.28s' }}
        >
          Every overlooked<br />
          <em className="intro-headline-em">drop</em> matters.
        </h1>

        {/* Tagline */}
        <p
          className={revealCls('intro-tagline')}
          style={{ transitionDelay: '0.48s' }}
        >
          Discover potential mosquito-breeding sources.
          <br className="intro-br" />
          Assess conditions. Prioritise action.
        </p>

        {/* Decorative divider */}
        <div
          className={revealCls('intro-divider')}
          aria-hidden="true"
          style={{ transitionDelay: '0.64s' }}
        />

        {/* CTA */}
        <div
          className={revealCls('intro-cta-wrap')}
          style={{ transitionDelay: '0.76s' }}
        >
          <button
            className="intro-enter-btn"
            onClick={handleEnter}
            aria-label="Enter SourceScan application"
          >
            <span>ENTER SOURCESCAN</span>
            <span className="intro-enter-arrow" aria-hidden="true">&#8594;</span>
            <span className="intro-enter-shine" aria-hidden="true" />
          </button>
          <p className="intro-sub-label">AI-ASSISTED ENVIRONMENTAL SCREENING</p>
        </div>

        {/* Water-ripple decoration */}
        {!reduced && (
          <div className="intro-ripples" aria-hidden="true">
            <span className="intro-ripple intro-ripple-1" />
            <span className="intro-ripple intro-ripple-2" />
            <span className="intro-ripple intro-ripple-3" />
          </div>
        )}
      </div>

      {/* ── Bottom disclaimer ── */}
      <p
        className={revealCls('intro-footer-note')}
        style={{ transitionDelay: '0.92s' }}
      >
        Independent screening tool&nbsp;&middot;&nbsp;Not a medical
        diagnostic&nbsp;&middot;&nbsp;Does not confirm breeding
      </p>
    </div>
  );
}
