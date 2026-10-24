import React, { useState, useEffect } from 'react';
import { listInspections, deleteInspection, getImageUrl } from '../api';
import PriorityBadge from '../components/PriorityBadge';
import {
  History as HistoryIcon,
  Search,
  Filter,
  Trash2,
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  PlusCircle,
  AlertCircle,
} from 'lucide-react';

export default function History({ onSelectInspection, setActivePage }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [riskFilter, setRiskFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Delete modal state
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadInspections = async () => {
    try {
      setLoading(true);
      setError(null);
      const filters = {};
      if (riskFilter) filters.risk = riskFilter;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      const data = await listInspections(filters);
      setInspections(data);
    } catch (err) {
      setError(err.message || 'Failed to load inspection history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInspections();
  }, [riskFilter, dateFrom, dateTo]);

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await deleteInspection(deleteId);
      setDeleteId(null);
      await loadInspections();
    } catch (err) {
      alert(`Could not delete inspection: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const filteredInspections = inspections.filter((insp) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const loc = (insp.locality || '').toLowerCase();
    const id = String(insp.id);
    return loc.includes(query) || id.includes(query);
  });

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
            Inspection History
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginTop: 4 }}>
            Historical record of all screening observations and saved priority assessments.
          </p>
        </div>

        <button
          onClick={() => setActivePage('new-inspection')}
          className="btn btn-primary"
        >
          <PlusCircle size={18} />
          <span>New Inspection</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: 24, padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, alignItems: 'flex-end' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.82rem' }}>Search Locality or ID</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.82rem' }}>Filter by Priority</label>
            <select
              className="form-select"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.82rem' }}>From Date</label>
            <input
              type="date"
              className="form-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.82rem' }}>To Date</label>
            <input
              type="date"
              className="form-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 24 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
          <p>Loading historical records...</p>
        </div>
      ) : filteredInspections.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '48px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-muted)',
            border: '1px dashed var(--color-border)',
          }}
        >
          <HistoryIcon size={40} color="var(--color-text-light)" style={{ marginBottom: 12 }} />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 6 }}>No Records Found</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: 420, margin: '0 auto 16px' }}>
            {searchQuery || riskFilter || dateFrom || dateTo
              ? 'No inspections matched your filter criteria. Try clearing filters.'
              : 'No inspection records exist in the database yet.'}
          </p>
          {(searchQuery || riskFilter || dateFrom || dateTo) ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setRiskFilter('');
                setDateFrom('');
                setDateTo('');
              }}
              className="btn btn-secondary btn-sm"
            >
              Clear Filters
            </button>
          ) : (
            <button onClick={() => setActivePage('new-inspection')} className="btn btn-primary">
              <PlusCircle size={16} />
              <span>Record First Inspection</span>
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', backgroundColor: 'var(--color-surface-muted)', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>ID / Photo</th>
                  <th style={{ padding: '12px 16px' }}>Date & Time</th>
                  <th style={{ padding: '12px 16px' }}>Locality</th>
                  <th style={{ padding: '12px 16px' }}>Priority Band</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInspections.map((insp) => (
                  <tr
                    key={insp.id}
                    style={{ borderBottom: '1px solid var(--color-border-subtle)', transition: 'background 0.15s' }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {insp.image_ref ? (
                          <img
                            src={getImageUrl(insp.image_ref)}
                            alt="Inspection thumbnail"
                            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              backgroundColor: 'var(--color-surface-muted)',
                              borderRadius: 'var(--radius-sm)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--color-text-light)',
                              fontSize: '0.75rem',
                            }}
                          >
                            No img
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700 }}>Inspection #{insp.id}</div>
                          {insp.is_sample && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>
                              (Sample row)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={14} />
                        <span>{new Date(insp.created_at).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--color-text-light)', marginTop: 2 }}>
                        <Clock size={12} />
                        <span>{new Date(insp.created_at).toLocaleTimeString()}</span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={14} color="var(--color-text-muted)" />
                        <span>{insp.locality || 'Unspecified'}</span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <PriorityBadge category={insp.overall_category} score={insp.overall_score} />
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          onClick={() => onSelectInspection(insp.id)}
                          className="btn btn-secondary btn-sm"
                          title="View inspection findings and evidence"
                        >
                          <span>Details</span>
                          <ArrowRight size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(insp.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--color-high)', borderColor: 'var(--color-high-border)' }}
                          title="Delete inspection and image"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-high)', marginBottom: 12 }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Delete Inspection #{deleteId}?</h3>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 20 }}>
              This action will permanently delete this inspection record and all its associated findings from the local database. 
              If the photograph is not shared by other records, it will also be securely removed from disk.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setDeleteId(null)}
                className="btn btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="btn btn-danger"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
