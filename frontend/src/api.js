/**
 * SourceScan API Client
 * Centralized API requests with error handling.
 */

const API_BASE = '/api';

async function handleResponse(response) {
  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data && data.detail) {
        errorDetail = data.detail;
      }
    } catch {
      // response was not JSON
    }
    const error = new Error(errorDetail);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return handleResponse(res);
}

export async function fetchConfig() {
  const res = await fetch(`${API_BASE}/config`);
  return handleResponse(res);
}

export async function analyzeImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse(res);
}

export async function createInspection(payload) {
  const res = await fetch(`${API_BASE}/inspections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function listInspections(filters = {}) {
  const params = new URLSearchParams();
  if (filters.risk) params.append('risk', filters.risk);
  if (filters.date_from) params.append('date_from', filters.date_from);
  if (filters.date_to) params.append('date_to', filters.date_to);

  const url = `${API_BASE}/inspections${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  return handleResponse(res);
}

export async function getInspection(id) {
  const res = await fetch(`${API_BASE}/inspections/${id}`);
  return handleResponse(res);
}

export async function updateFinding(inspectionId, findingId, updateData) {
  const res = await fetch(`${API_BASE}/inspections/${inspectionId}/findings/${findingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  });
  return handleResponse(res);
}

export async function deleteInspection(id) {
  const res = await fetch(`${API_BASE}/inspections/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(res);
}

export async function fetchAnalytics() {
  const res = await fetch(`${API_BASE}/analytics`);
  return handleResponse(res);
}

export function getImageUrl(imageRef) {
  if (!imageRef) return null;
  return `/api/images/${imageRef}`;
}
