import { useState } from 'react';
import { runAnomalyDetection } from '../api/client';
import styles from './RunControls.module.css';

export default function RunControls({
  uploadResult,
  uploadRevision,
  onRunStart,
  onRunSuccess,
}) {
  const [autoComponents, setAutoComponents] = useState(true);
  const [nComponents, setNComponents] = useState(3);
  const [threshold, setThreshold] = useState(95);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUsedComponents, setLastUsedComponents] = useState(null);
  const maxComponents = uploadResult
    ? Math.max(1, Math.min(20, uploadResult.n_features - 1))
    : 1;

  const handleRun = async (e) => {
    e.preventDefault();
    const revision = uploadRevision;
    onRunStart();
    setLoading(true);
    setError(null);
    try {
      const result = await runAnomalyDetection(uploadResult.dataset_id, {
        n_components: autoComponents ? null : nComponents,
        threshold_percentile: threshold,
      });
      setLastUsedComponents(result.n_components_used ?? null);
      onRunSuccess(result, revision);
    } catch (err) {
      setError(err.message || 'Run failed');
    } finally {
      setLoading(false);
    }
  };

  if (!uploadResult?.success) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>2. Run PCA anomaly detection</h2>
      <form onSubmit={handleRun} className={styles.form}>
        <div className={styles.row}>
          <div className={styles.col}>
            <div className={styles.labelRow}>
              <span className={styles.labelText}>Components</span>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={autoComponents}
                  onChange={(e) => {
                    setAutoComponents(e.target.checked);
                    if (!e.target.checked) {
                      setNComponents(Math.min(3, maxComponents));
                    }
                  }}
                  className={styles.checkbox}
                />
                Auto (95% variance)
              </label>
            </div>
            {!autoComponents ? (
              <input
                type="number"
                min={1}
                max={maxComponents}
                value={nComponents}
                onChange={(e) => setNComponents(Number(e.target.value))}
                className={styles.input}
              />
            ) : (
              <span className={styles.readOnly}>
                {lastUsedComponents != null ? `${lastUsedComponents} (last run)` : '—'}
              </span>
            )}
          </div>
          <label className={styles.col}>
            <div className={styles.labelRow}>
              <span className={styles.labelText}>Threshold percentile</span>
            </div>
            <input
              type="number"
              min={1}
              max={99.99}
              step={0.5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className={styles.input}
            />
          </label>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? 'Running…' : 'Run'}
        </button>
      </form>
    </section>
  );
}
