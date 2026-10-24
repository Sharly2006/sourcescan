import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Layers } from 'lucide-react';

export default function BoundingBoxOverlay({
  imageSrc,
  detections = [],
  highlightIndex = null,
  onSelectDetection = null,
}) {
  const [showBoxes, setShowBoxes] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalDimensions, setNaturalDimensions] = useState({ width: 0, height: 0 });
  const imgRef = useRef(null);

  const handleImageLoad = (e) => {
    setImageLoaded(true);
    setNaturalDimensions({
      width: e.target.naturalWidth,
      height: e.target.naturalHeight,
    });
  };

  // Color generator for detection boxes
  const getColor = (index, isHighlighted) => {
    if (isHighlighted) return '#dc2626';
    const palette = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    return palette[index % palette.length];
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {detections.length > 0 ? `${detections.length} AI Detection${detections.length > 1 ? 's' : ''}` : 'Image Evidence'}
        </span>
        {detections.length > 0 && (
          <button
            type="button"
            onClick={() => setShowBoxes(!showBoxes)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
          >
            {showBoxes ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showBoxes ? 'Hide Bounding Boxes' : 'Show Bounding Boxes'}</span>
          </button>
        )}
      </div>

      <div
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          backgroundColor: '#1a1a1a',
          boxShadow: 'var(--shadow-sm)',
          lineHeight: 0,
        }}
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Inspection target"
          onLoad={handleImageLoad}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            objectFit: 'contain',
            maxHeight: '480px',
          }}
        />

        {showBoxes && imageLoaded && detections.length > 0 && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {detections.map((det, idx) => {
              if (!det.bbox || det.bbox.length !== 4) return null;
              const [x1, y1, x2, y2] = det.bbox;
              // normalized coords 0.0 - 1.0 converted to viewBox 0 - 100
              const bx = x1 * 100;
              const by = y1 * 100;
              const bw = (x2 - x1) * 100;
              const bh = (y2 - y1) * 100;

              const isHighlighted = highlightIndex === idx;
              const boxColor = getColor(idx, isHighlighted);

              const labelText = `${det.container_type || det.raw_class} ${det.confidence ? `${Math.round(det.confidence * 100)}%` : ''}`.trim();
              const labelWidth = Math.min(bw + 6, Math.max(18, labelText.length * 1.55 + 3));
              const labelHeight = 4.2;

              // Smart label positioning: place above if room, inside top if near image edge
              let labelY = by >= 5 ? by - labelHeight - 0.4 : by + 0.6;
              let labelX = Math.max(0.5, Math.min(99.5 - labelWidth, bx));

              // If another detection's label is close, adjust position to avoid collision
              for (let j = 0; j < idx; j++) {
                const prev = detections[j];
                if (prev && prev.bbox && prev.bbox.length === 4) {
                  const pby = prev.bbox[1] * 100;
                  const pbx = prev.bbox[0] * 100;
                  if (Math.abs(pby - by) < 6 && Math.abs(pbx - bx) < 24) {
                    // Stagger position: alternate inside bottom or offset horizontally
                    if (by + bh + labelHeight <= 99) {
                      labelY = by + bh - labelHeight - 0.6;
                    } else {
                      labelY = by + labelHeight + 1.0;
                    }
                    break;
                  }
                }
              }

              return (
                <g key={idx} style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => onSelectDetection && onSelectDetection(idx)}>
                  <rect
                    x={bx}
                    y={by}
                    width={bw}
                    height={bh}
                    fill={isHighlighted ? 'rgba(220, 38, 38, 0.25)' : 'rgba(255, 255, 255, 0.05)'}
                    stroke={boxColor}
                    strokeWidth={isHighlighted ? 0.9 : 0.6}
                    strokeDasharray={isHighlighted ? 'none' : 'none'}
                    rx="0.5"
                  />
                  {/* Label badge */}
                  <rect
                    x={labelX}
                    y={labelY}
                    width={labelWidth}
                    height={labelHeight}
                    fill={boxColor}
                    rx="0.6"
                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.6))"
                  />
                  <text
                    x={labelX + 1.2}
                    y={labelY + 3.0}
                    fill="#ffffff"
                    fontSize="2.5"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fontWeight="700"
                    letterSpacing="0.02em"
                  >
                    {labelText}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
