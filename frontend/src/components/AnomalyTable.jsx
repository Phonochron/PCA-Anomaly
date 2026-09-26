import { useMemo, useState } from 'react';
import styles from './AnomalyTable.module.css';

export default function AnomalyTable({ anomalyDetails = [] }) {
  const [expandedRow, setExpandedRow] = useState(null);

  const anomaliesOnly = useMemo(
    () => anomalyDetails.filter((d) => d.is_anomaly),
    [anomalyDetails]
  );
  const normalCount = anomalyDetails.length - anomaliesOnly.length;

  const [showAll, setShowAll] = useState(false);
  const rowsToShow = showAll ? anomalyDetails : anomaliesOnly;

  if (!anomalyDetails.length) {
    return (
      <section className={styles.section}>
        <h2 className={styles.title}>3. Anomaly details</h2>
        <p className={styles.placeholder}>Run PCA to see anomaly rows and contributing features.</p>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>
        3. Anomaly details
        <span className={styles.badge}>
          {anomaliesOnly.length.toLocaleString()} anomalies · {normalCount.toLocaleString()} normal
        </span>
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show only anomalies' : 'Show all rows'}
        </button>
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Row</th>
              <th>Status</th>
              <th>Reconstruction error</th>
              <th>Top contributing features</th>
            </tr>
          </thead>
          <tbody>
            {rowsToShow.map((row) => (
              <tr
                key={row.row_index}
                className={row.is_anomaly ? styles.anomalyRow : ''}
                onClick={() => setExpandedRow(expandedRow === row.row_index ? null : row.row_index)}
              >
                <td className={styles.mono}>{row.row_index + 1}</td>
                <td>
                  <span className={row.is_anomaly ? styles.anomLabel : styles.normLabel}>
                    {row.is_anomaly ? 'Anomaly' : 'Normal'}
                  </span>
                </td>
                <td className={styles.mono}>{row.reconstruction_error.toFixed(6)}</td>
                <td>
                  <div className={styles.features}>
                    {row.top_features.slice(0, expandedRow === row.row_index ? 10 : 3).map((f, i) => (
                      <span key={i} className={styles.featureChip}>
                        {f.name}: {f.contribution.toFixed(4)}
                      </span>
                    ))}
                    {row.top_features.length > 3 && expandedRow !== row.row_index && (
                      <button
                        type="button"
                        className={styles.moreBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedRow(row.row_index);
                        }}
                      >
                        +{row.top_features.length - 3} more
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.hint}>Click a row to expand top contributing features.</p>
    </section>
  );
}
