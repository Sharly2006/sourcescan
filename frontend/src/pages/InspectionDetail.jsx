import React, { useState, useEffect } from 'react';
import { getInspection, updateFinding, deleteInspection, getImageUrl, fetchConfig } from '../api';
import BoundingBoxOverlay from '../components/BoundingBoxOverlay';
import PriorityBadge from '../components/PriorityBadge';
import ScoreCalculator from '../components/ScoreCalculator';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Shield,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Layers,
  Edit2,
  Check,
  X,
} from 'lucide-react';

export default function InspectionDetail({ inspectionId, onBack, onDeleted }) {
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);

  // Edit finding modal or inline state
  const [editingFindingId, setEditingFindingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [insp, cfg] = await Promise.all([
        getInspection(inspectionId),
        fetchConfig().catch(() => null),
      ]);
      setInspection(insp);
      setConfig(cfg);
    } catch (err) {
      setError(err.message || 'Failed to load inspection details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [inspectionId]);

  const handleStartEdit = (finding) => {
    setEditingFindingId(finding.id);
    setEditData({
      container_type: finding.container_type,
      water_status: finding.water_status || 'uncertain',
      covered: Boolean(finding.covered),
      user_decision: finding.user_decision || 'corrected',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingFindingId) return;
    try {
      setSavingEdit(true);
      const updated = await updateFinding(inspectionId, editingFindingId, editData);
      setInspection(updated);
      setEditingFindingId(null);
    } catch (err) {
      alert(`Failed to update finding: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteInspection(inspectionId);
      if (onDeleted) onDeleted();
      else onBack();
    } catch (err) {
      alert(`Failed to delete inspection: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
        <p>Loading inspection #{inspectionId}...</p>
      </div>
    );
  }

  if (error || !inspection) {
    return (
      <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          <AlertCircle size={18} />
          <span>{error || 'Inspection not found.'}</span>
        </div>
        <button onClick={onBack} className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Back to History</span>
        </button>
      </div>
    );
  }

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

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Top Bar Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={onBack} className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          <span>Back to History</span>
        </button>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="btn btn-secondary btn-sm"
          style={{ color: 'var(--color-high)', borderColor: 'var(--color-high-border)' }}
        >
          <Trash2 size={16} />
          <span>Delete Inspection</span>
        </button>
      </div>

      {/* Inspection Header Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
                Inspection #{inspection.id}
              </h1>
              {inspection.is_sample && (
                <span className="badge badge-neutral" style={{ fontStyle: 'italic' }}>Sample Dataset</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={15} />
                <span>{new Date(inspection.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={15} />
                <span>{new Date(inspection.created_at).toLocaleTimeString()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={15} />
                <span>{inspection.locality || 'Unspecified'}</span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
              Overall Screening Priority
            </div>
            <PriorityBadge category={inspection.overall_category} score={inspection.overall_score} />
          </div>
        </div>
      </div>

      {/* Visual Evidence Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 className="card-title">Image Evidence & Annotations</h2>
        <p className="card-subtitle">
          Recorded photograph with detection bounding boxes.
        </p>

        {inspection.image_ref ? (
          <BoundingBoxOverlay
            imageSrc={getImageUrl(inspection.image_ref)}
            detections={inspection.findings}
          />
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--color-surface-muted)', borderRadius: 'var(--radius-sm)' }}>
            <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
              No image file associated with this record.
            </p>
          </div>
        )}
      </div>

      {/* Recorded Findings Breakdown */}
      <div className="card">
        <h2 className="card-title">Recorded Findings & Observations</h2>
        <p className="card-subtitle">
          Distinction between original AI prediction and human-confirmed observations.
        </p>

        {inspection.findings.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No container findings attached to this inspection.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {inspection.findings.map((f, idx) => {
              const isEditing = editingFindingId === f.id;

              return (
                <div
                  key={f.id}
                  style={{
                    border: f.user_decision === 'rejected' ? '1px dashed var(--color-border)' : '1px solid var(--color-border-strong)',
                    borderRadius: 'var(--radius-md)',
                    padding: 20,
                    backgroundColor: f.user_decision === 'rejected' ? 'rgba(17, 28, 23, 0.45)' : 'var(--color-surface)',
                    boxShadow: f.user_decision === 'rejected' ? 'none' : 'var(--shadow-md)',
                    opacity: f.user_decision === 'rejected' ? 0.65 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>
                          Finding #{idx + 1}
                        </span>
                        {f.source === 'user' ? (
                          <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>Manual Documentation</span>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '0.72rem', borderColor: 'rgba(52, 211, 153, 0.35)', color: 'var(--color-primary)' }}>AI Detector Finding</span>
                        )}
                        {f.user_decision === 'confirmed' && (
                          <span className="badge badge-low" style={{ fontSize: '0.72rem' }}>Confirmed</span>
                        )}
                        {f.user_decision === 'corrected' && (
                          <span className="badge badge-medium" style={{ fontSize: '0.72rem' }}>User Corrected</span>
                        )}
                        {f.user_decision === 'rejected' && (
                          <span className="badge badge-high" style={{ fontSize: '0.72rem' }}>Rejected</span>
                        )}
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, textTransform: 'capitalize', color: 'var(--color-text-main)' }}>
                        {f.container_type}
                        {f.confidence && (
                          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-light)', marginLeft: 8 }}>
                            ({Math.round(f.confidence * 100)}% confidence)
                          </span>
                        )}
                      </div>
                      {f.raw_class && f.raw_class !== f.container_type && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                          Original model label: "{f.raw_class}"
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <PriorityBadge category={f.category} score={f.score} />
                      {!isEditing && (
                        <button
                          onClick={() => handleStartEdit(f)}
                          className="btn btn-secondary btn-sm"
                          title="Edit finding observations"
                        >
                          <Edit2 size={14} />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div style={{ backgroundColor: 'var(--color-surface-muted)', padding: 14, borderRadius: 'var(--radius-sm)', marginTop: 12 }}>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: 10 }}>Update Finding Observations</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>Container Category</label>
                          <select
                            className="form-select"
                            value={editData.container_type}
                            onChange={(e) => setEditData({ ...editData, container_type: e.target.value })}
                          >
                            {containerTypes.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>Water Status</label>
                          <select
                            className="form-select"
                            value={editData.water_status}
                            onChange={(e) => setEditData({ ...editData, water_status: e.target.value })}
                          >
                            <option value="present">Water Present (+4)</option>
                            <option value="uncertain">Water Uncertain (+2)</option>
                            <option value="absent">Water Absent (+0)</option>
                          </select>
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>Covering</label>
                          <select
                            className="form-select"
                            value={editData.covered ? 'true' : 'false'}
                            onChange={(e) => setEditData({ ...editData, covered: e.target.value === 'true' })}
                          >
                            <option value="false">Uncovered (0)</option>
                            <option value="true">Tightly Covered (-2)</option>
                          </select>
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>User Decision</label>
                          <select
                            className="form-select"
                            value={editData.user_decision}
                            onChange={(e) => setEditData({ ...editData, user_decision: e.target.value })}
                          >
                            <option value="confirmed">Confirmed</option>
                            <option value="corrected">Corrected</option>
                            <option value="rejected">Rejected (Score 0)</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button onClick={() => setEditingFindingId(null)} className="btn btn-secondary btn-sm" disabled={savingEdit}>
                          Cancel
                        </button>
                        <button onClick={handleSaveEdit} className="btn btn-primary btn-sm" disabled={savingEdit}>
                          <Check size={14} />
                          <span>{savingEdit ? 'Updating...' : 'Save Changes'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, margin: '12px 0', fontSize: '0.88rem' }}>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Water Status:</span>{' '}
                          <strong style={{ textTransform: 'capitalize' }}>{f.water_status || 'uncertain'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>Cover Status:</span>{' '}
                          <strong>{f.covered ? 'Tightly covered (-2)' : 'Uncovered (0)'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>User Decision:</span>{' '}
                          <strong style={{ textTransform: 'capitalize' }}>{f.user_decision || 'Confirmed'}</strong>
                        </div>
                      </div>

                      <div style={{ background: 'var(--color-surface-muted)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                        <div><strong>Score Explanation:</strong> {f.explanation || 'Calculated by heuristic scoring rules.'}</div>
                        <div style={{ marginTop: 4 }}><strong>Recommended Action:</strong> {f.action || 'Inspect container.'}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-high)', marginBottom: 12 }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Delete Inspection #{inspection.id}?</h3>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to delete this inspection and its findings? If the photo is not used by any other inspection, it will also be deleted from disk.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="btn btn-danger"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
