const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').trim().replace(/\/+$/, '');

function datasetHeaders(datasetId) {
  if (!datasetId) throw new Error('Upload a CSV first.');
  return { 'X-Dataset-ID': datasetId };
}

async function ensureOk(response, fallbackMessage) {
  if (response.ok) return;
  const payload = await response.json().catch(() => ({}));
  const message = typeof payload.detail === 'string' ? payload.detail : fallbackMessage;
  throw new Error(message);
}

export async function uploadCsv(file, labelColumn = null, encoding = 'utf-8') {
  const form = new FormData();
  form.append('file', file);
  if (labelColumn) form.append('label_column', labelColumn);
  form.append('encoding', encoding);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: form,
  });
  await ensureOk(response, 'Upload failed');
  return response.json();
}

export async function runAnomalyDetection(datasetId, options = {}) {
  const { n_components = null, threshold_percentile = 95 } = options;
  const response = await fetch(`${API_BASE}/run`, {
    method: 'POST',
    headers: {
      ...datasetHeaders(datasetId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      n_components: n_components == null ? null : Number(n_components),
      threshold_percentile: Number(threshold_percentile),
    }),
  });
  await ensureOk(response, 'Run failed');
  return response.json();
}

async function downloadCsv(datasetId, path, filename) {
  const response = await fetch(`${API_BASE}/download/${path}`, {
    headers: datasetHeaders(datasetId),
  });
  await ensureOk(response, 'Download failed');

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCleanedCsv(datasetId) {
  return downloadCsv(datasetId, 'cleaned', 'cleaned_normal_only.csv');
}

export function downloadAnomaliesCsv(datasetId) {
  return downloadCsv(datasetId, 'anomalies', 'anomalies_only.csv');
}
