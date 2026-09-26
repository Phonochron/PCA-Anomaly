import { useState } from 'react';
import { uploadCsv } from '../api/client';
import styles from './FileUpload.module.css';

const PRESETS = [
  {
    id: 'clusters',
    name: 'Simple Clusters',
    description: '3D synthetic cluster points with a few distant outlier anomalies.',
    filename: 'synthetic_clusters.csv',
    labelColumn: 'is_anomaly',
    icon: '📊'
  },
  {
    id: 'cardio',
    name: 'Cardio Metrics',
    description: 'Patient health telemetry (HR, Blood Pressure, SpO2) showing cardiac anomalies.',
    filename: 'cardio_metrics.csv',
    labelColumn: 'label',
    icon: '❤️'
  },
  {
    id: 'server',
    name: 'Server Metrics',
    description: 'IT server node metrics (CPU, RAM, disk IO, net) with spikes & freeze anomalies.',
    filename: 'server_metrics.csv',
    labelColumn: 'status',
    icon: '🖥️'
  },
  {
    id: 'financial',
    name: 'Financial Fraud',
    description: 'Transactional speed, distance, and amount tracking credit card frauds.',
    filename: 'financial_tx.csv',
    labelColumn: 'is_fraud',
    icon: '💳'
  },
  {
    id: 'industrial',
    name: 'Industrial Machinery',
    description: 'Sensors tracking vibration, temp, speed, and pressure for bearing failures.',
    filename: 'industrial_sensors.csv',
    labelColumn: 'anomaly',
    icon: '⚙️'
  }
];

export default function FileUpload({ onUploadStart, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [labelColumn, setLabelColumn] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setSelectedPresetId(null);
    setError(null);
  };

  const handlePresetSelect = async (preset) => {
    setLoading(true);
    setError(null);
    setSelectedPresetId(preset.id);
    try {
      const response = await fetch(`/presets/${preset.filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load preset: ${response.statusText}`);
      }
      const blob = await response.blob();
      const loadedFile = new File([blob], preset.filename, { type: 'text/csv' });
      setFile(loadedFile);
      setLabelColumn(preset.labelColumn);
    } catch (err) {
      setError(err.message || 'Failed to load preset dataset.');
      setFile(null);
      setSelectedPresetId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select or upload a CSV file.');
      return;
    }
    onUploadStart();
    setLoading(true);
    setError(null);
    try {
      const result = await uploadCsv(file, labelColumn || null);
      if (!result.success) {
        setError(result.error || 'Upload failed');
        return;
      }
      onUploadSuccess(result);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>1. Select or Upload CSV Dataset</h2>
      
      <div className={styles.presetsWrapper}>
        <span className={styles.presetsLabel}>Choose a sample dataset to test instantly:</span>
        <div className={styles.presetsGrid}>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`${styles.presetCard} ${
                selectedPresetId === preset.id ? styles.presetCardActive : ''
              }`}
              onClick={() => handlePresetSelect(preset)}
              disabled={loading}
            >
              <span className={styles.presetIcon}>{preset.icon}</span>
              <div className={styles.presetInfo}>
                <span className={styles.presetName}>{preset.name}</span>
                <span className={styles.presetDesc}>{preset.description}</span>
                <span className={styles.presetMeta}>
                  Label: <code>{preset.labelColumn}</code>
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.divider}>
        <span>or upload your own file</span>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.row}>
          <div className={styles.fileCol}>
            <span className={styles.fileLabelText}>CSV file</span>
            <div className={styles.fileInputRow}>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className={styles.input}
                id="csv-file-input"
              />
              {file && <span className={styles.fileName} title={file.name}>{file.name}</span>}
            </div>
          </div>
          <label className={styles.labelField}>
            <span className={styles.labelFieldText}>Label column (optional)</span>
            <input
              type="text"
              placeholder="e.g. label, target, class"
              value={labelColumn}
              onChange={(e) => setLabelColumn(e.target.value)}
              className={styles.labelInput}
            />
          </label>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? 'Processing…' : 'Upload & Load'}
        </button>
      </form>
    </section>
  );
}
