import React, { useState, useEffect } from 'react';
import { analyzeImage, createInspection, fetchConfig, getImageUrl } from '../api';
import BoundingBoxOverlay from '../components/BoundingBoxOverlay';
import ScoreCalculator from '../components/ScoreCalculator';
import PriorityBadge from '../components/PriorityBadge';
import {
  Upload,
  Camera,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  X,
  Plus,
  RefreshCw,
  Shield,
  Layers,
  ArrowRight,
  Info,
  Check,
} from 'lucide-react';

export default function NewInspection({ onInspectionSaved, setActivePage }) {
  // Steps: 1: select, 2: analyzing, 3: review & save
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Analysis result
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Review state
  const [findings, setFindings] = useState([]);
  const [locality, setLocality] = useState('');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Config data from backend
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch((e) => console.warn('Could not fetch config:', e));
  }, []);

  const containerTypes = config?.container_types || [
    'tyre',
    'bucket',
    'drum/barrel',
    'water tank or sump',
    'cement tub',
    'plant pot or saucer',
    'drip tray or ac tray',
    'drain inlet',
    'bottle',
    'coconut shell',
    'other',
  ];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setUploadError('Only JPG, JPEG, and PNG images are supported.');
      return;
    }

    const maxMb = config?.max_upload_mb || 5;
    if (file.size > maxMb * 1024 * 1024) {
      setUploadError(`Image exceeds maximum allowed size of ${maxMb}MB.`);
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleClearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    setAnalysisResult(null);
    setFindings([]);
    setStep(1);
  };

  const handleRunAnalysis = async () => {
    if (!selectedFile) return;

    try {
      setAnalyzing(true);
      setUploadError(null);
      setStep(2);

      const result = await analyzeImage(selectedFile);
      setAnalysisResult(result);

      // Initialize reviewable findings
      const initialFindings = (result.detections || []).map((det, idx) => ({
        id: `ai_${idx}`,
        container_type: det.container_type || 'other',
        source: det.source || 'ai',
        raw_class: det.raw_class || det.container_type,
        confidence: det.confidence,
        bbox: det.bbox,
        warning: det.warning,
        water_status: 'uncertain',
        water_source: 'user',
        covered: false,
        user_decision: 'confirmed', // confirmed | corrected | rejected
      }));

      setFindings(initialFindings);
      setStep(3);
    } catch (err) {
      setUploadError(err.message || 'Image analysis failed. Please try again.');
      setStep(1);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddManualFinding = () => {
    const newFinding = {
      id: `manual_${Date.now()}`,
      container_type: 'other',
      source: 'user',
      raw_class: 'manually added',
      confidence: null,
      bbox: null,
      water_status: 'uncertain',
      water_source: 'user',
      covered: false,
      user_decision: 'confirmed',
    };
    setFindings([...findings, newFinding]);
  };

  const handleUpdateFinding = (index, updates) => {
    const updated = [...findings];
    updated[index] = { ...updated[index], ...updates };
    setFindings(updated);
  };

  const handleRemoveFinding = (index) => {
    setFindings(findings.filter((_, i) => i !== index));
  };

  const handleSaveInspection = async () => {
    if (!consent) {
      setSaveError('You must acknowledge the upload consent to save this inspection.');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);

      // Filter out rejected findings from saved inspection
      const payloadFindings = findings.map((f) => ({
        container_type: f.container_type,
        source: f.source,
        confidence: f.confidence,
        bbox: f.bbox,
        water_status: f.water_status,
        water_source: f.water_source,
        covered: f.covered,
        raw_class: f.raw_class,
        user_decision: f.user_decision,
      }));

      const payload = {
        locality: locality.trim() || 'Unspecified',
        image_id: analysisResult?.image_id,
        consent: true,
        findings: payloadFindings,
        is_sample: analysisResult?.mode === 'demo',
      };

      const saved = await createInspection(payload);
      if (onInspectionSaved) {
        onInspectionSaved(saved.id);
      } else {
        setActivePage('history');
      }
    } catch (err) {
      setSaveError(err.message || 'Failed to save inspection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
          New Source Inspection
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginTop: 4 }}>
          Upload a photograph of a potential mosquito breeding container for AI-assisted screening and review.
        </p>
      </div>

      {/* Step 1: Select Image */}
      {step === 1 && (
        <div className="card">
          <h2 className="card-title">Step 1: Select an Image</h2>
          <p className="card-subtitle">
            Supported formats: JPG, JPEG, PNG (max {config?.max_upload_mb || 5}MB). GPS metadata is automatically stripped.
          </p>

          {uploadError && (
            <div className="alert alert-danger">
              <AlertCircle size={18} />
              <span>{uploadError}</span>
            </div>
          )}

          {!previewUrl ? (
            <div
              style={{
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '48px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface-muted)',
              }}
            >
              <Upload size={40} color="var(--color-primary)" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>
                Upload or Take a Photo
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: 420, margin: '0 auto 20px' }}>
                Capture containers such as tyres, buckets, plant saucers, drums, or outdoor water vessels. Avoid photographing people.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                <label className="btn btn-primary">
                  <Upload size={16} />
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </label>

                <label className="btn btn-secondary">
                  <Camera size={16} />
                  <span>Capture Photo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    capture="environment"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto 20px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '420px', objectFit: 'contain', backgroundColor: '#1a1a1a' }}
                />
                <button
                  onClick={handleClearImage}
                  className="btn btn-secondary btn-sm"
                  style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.9)' }}
                  title="Remove image"
                >
                  <X size={16} />
                  <span>Change Image</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button onClick={handleClearImage} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleRunAnalysis} className="btn btn-primary" disabled={analyzing}>
                  <Shield size={16} />
                  <span>Analyze Potential Sources</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Analyzing State */}
      {step === 2 && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <RefreshCw size={36} color="var(--color-primary)" className="spinner" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>
            Analyzing Image for Potential Containers...
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: 440, margin: '0 auto' }}>
            Validating image integrity, stripping EXIF/GPS metadata, and executing computer vision inference.
          </p>
        </div>
      )}

      {/* Step 3: Review Findings & Calculate Priority */}
      {step === 3 && analysisResult && (
        <div>
          {/* Banner Notice */}
          {analysisResult.banner && (
            <div className={`alert ${analysisResult.mode === 'demo' ? 'alert-warning' : 'alert-info'}`}>
              <Info size={18} />
              <div>
                <strong>{analysisResult.mode === 'demo' ? 'Demo Mode Notice: ' : 'AI Screening Notice: '}</strong>
                {analysisResult.banner}
              </div>
            </div>
          )}

          {/* Visual Evidence Section */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 className="card-title">Image Evidence & Detection Bounding Boxes</h2>
            <p className="card-subtitle">
              Model: <strong>{analysisResult.model_name}</strong> ({analysisResult.mode} mode)
            </p>

            <BoundingBoxOverlay
              imageSrc={previewUrl || getImageUrl(`${analysisResult.image_id}.jpg`)}
              detections={findings.filter((f) => f.user_decision !== 'rejected')}
            />
          </div>

          {/* Findings Review List */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>Review & Confirm Observations</h2>
                <p className="card-subtitle" style={{ margin: 0, marginTop: 4 }}>
                  Verify AI-detected objects or record observations directly. The heuristic score updates in real-time.
                </p>
              </div>
              <button onClick={handleAddManualFinding} className="btn btn-secondary btn-sm">
                <Plus size={16} />
                <span>Add Manual Container</span>
              </button>
            </div>

            {findings.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', backgroundColor: 'var(--color-surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 12 }}>
                  No relevant containers were detected automatically. You can add one manually.
                </p>
                <button onClick={handleAddManualFinding} className="btn btn-primary btn-sm">
                  <Plus size={14} />
                  <span>Document Container Manually</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {findings.map((finding, idx) => {
                  const isRejected = finding.user_decision === 'rejected';
                  const isConfirmed = finding.user_decision === 'confirmed';
                  const isCorrected = finding.user_decision === 'corrected';
                  const isUserSource = finding.source === 'user';

                  return (
                    <div
                      key={finding.id}
                      style={{
                        border: isRejected ? '1px dashed var(--color-border)' : '1px solid var(--color-border-strong)',
                        borderRadius: 'var(--radius-md)',
                        padding: 20,
                        backgroundColor: isRejected ? 'rgba(17, 28, 23, 0.45)' : 'var(--color-surface)',
                        boxShadow: isRejected ? 'none' : 'var(--shadow-md)',
                        opacity: isRejected ? 0.65 : 1,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-light)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                              Finding #{idx + 1}
                            </span>
                            {isUserSource ? (
                              <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                                Manual Entry
                              </span>
                            ) : (
                              <span className="badge badge-neutral" style={{ fontSize: '0.72rem', borderColor: 'rgba(52, 211, 153, 0.35)', color: 'var(--color-primary)' }}>
                                AI Suggestion
                              </span>
                            )}
                            {isConfirmed && (
                              <span className="badge badge-low" style={{ fontSize: '0.72rem' }}>
                                Confirmed
                              </span>
                            )}
                            {isCorrected && (
                              <span className="badge badge-medium" style={{ fontSize: '0.72rem' }}>
                                User Corrected
                              </span>
                            )}
                            {isRejected && (
                              <span className="badge badge-high" style={{ fontSize: '0.72rem' }}>
                                Rejected
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'capitalize', color: 'var(--color-text-main)' }}>
                            {finding.container_type}
                            {finding.confidence && (
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)', marginLeft: 8 }}>
                                ({Math.round(finding.confidence * 100)}% model confidence)
                              </span>
                            )}
                          </div>

                          {finding.raw_class && finding.raw_class !== finding.container_type && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                              Raw model label: <code style={{ color: 'var(--color-text-main)', background: 'var(--color-surface-muted)', padding: '2px 6px', borderRadius: 4 }}>{finding.raw_class}</code>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleUpdateFinding(idx, { user_decision: 'confirmed' })}
                            className={`btn btn-sm ${isConfirmed ? 'btn-primary' : 'btn-secondary'}`}
                            title="Confirm this observation for screening"
                          >
                            <Check size={14} />
                            <span>Confirm</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateFinding(idx, { user_decision: isRejected ? 'confirmed' : 'rejected' })}
                            className={`btn btn-sm ${isRejected ? 'btn-danger' : 'btn-secondary'}`}
                            style={!isRejected ? { borderColor: 'rgba(248, 113, 113, 0.35)', color: 'var(--color-text-muted)' } : {}}
                            title={isRejected ? "Undo rejection" : "Reject this observation"}
                          >
                            <X size={14} />
                            <span>{isRejected ? 'Undo Reject' : 'Reject'}</span>
                          </button>
                        </div>
                      </div>

                      {isRejected ? (
                        <div style={{ padding: '8px 12px', background: 'rgba(248, 113, 113, 0.08)', border: '1px solid var(--color-high-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--color-high)' }}>
                          This observation has been marked as rejected and will be excluded from final risk calculation.
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
                            {/* Container Category correction */}
                            <div>
                              <label className="form-label" style={{ fontSize: '0.82rem' }}>Container Category</label>
                              <select
                                className="form-select"
                                value={finding.container_type}
                                onChange={(e) => handleUpdateFinding(idx, { container_type: e.target.value, user_decision: 'corrected' })}
                              >
                                {containerTypes.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Water status observation */}
                            <div>
                              <label className="form-label" style={{ fontSize: '0.82rem' }}>Water Status (Observed)</label>
                              <select
                                className="form-select"
                                value={finding.water_status}
                                onChange={(e) => handleUpdateFinding(idx, { water_status: e.target.value })}
                              >
                                <option value="present">Water Present (+4)</option>
                                <option value="uncertain">Water Uncertain (+2)</option>
                                <option value="absent">Water Absent (+0)</option>
                              </select>
                            </div>

                            {/* Cover status */}
                            <div>
                              <label className="form-label" style={{ fontSize: '0.82rem' }}>Container Covering</label>
                              <select
                                className="form-select"
                                value={finding.covered ? 'true' : 'false'}
                                onChange={(e) => handleUpdateFinding(idx, { covered: e.target.value === 'true' })}
                              >
                                <option value="false">Uncovered (0)</option>
                                <option value="true">Tightly Covered (-2)</option>
                              </select>
                            </div>
                          </div>

                          {/* Live Score Calculator for this finding */}
                          <ScoreCalculator
                            containerType={finding.container_type}
                            waterStatus={finding.water_status}
                            covered={finding.covered}
                            baseScores={config?.base_scores}
                            actions={config?.actions}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 6: Save Section */}
          <div className="card">
            <h2 className="card-title">Step 6: Save Inspection</h2>
            <p className="card-subtitle">
              Record this inspection in the local database for historical tracking.
            </p>

            {saveError && (
              <div className="alert alert-danger">
                <AlertCircle size={18} />
                <span>{saveError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Locality / Area Name (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Adyar, Back garden, Balcony"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span style={{ color: 'var(--color-text-main)' }}>
                  {config?.consent_text || 'I have permission to upload this image; avoid photographing people'}
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={() => setStep(1)} className="btn btn-secondary">
                Restart
              </button>
              <button onClick={handleSaveInspection} className="btn btn-primary" disabled={saving || !consent}>
                <CheckCircle size={16} />
                <span>{saving ? 'Saving Inspection...' : 'Save Inspection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
