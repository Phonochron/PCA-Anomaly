import { useState } from 'react';
import { downloadCleanedCsv, downloadAnomaliesCsv } from '../api/client';
import styles from './DownloadSection.module.css';

export default function DownloadSection({ datasetId }) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const handleCleaned = async () => {
    setError(null);
    setLoading('cleaned');
    try {
      await downloadCleanedCsv(datasetId);
    } catch (e) {
      setError(e.message || 'Download failed');
    } finally {
      setLoading(null);
    }
  };

  const handleAnomalies = async () => {
    setError(null);
    setLoading('anomalies');
    try {
      await downloadAnomaliesCsv(datasetId);
    } catch (e) {
      setError(e.message || 'Download failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>4. Download results</h2>
      <p className={styles.description}>
        Download the dataset split by PCA predictions: cleaned data (normal rows only) or anomalies only.
      </p>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.btn}
          onClick={handleAnomalies}
          disabled={loading != null}
        >
          {loading === 'anomalies' ? 'Downloading…' : 'Download anomalies CSV'}
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={handleCleaned}
          disabled={loading != null}
        >
          {loading === 'cleaned' ? 'Downloading…' : 'Download cleaned CSV'}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
