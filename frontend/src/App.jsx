import { useRef, useState } from 'react';
import FileUpload from './components/FileUpload';
import RunControls from './components/RunControls';
import Scatter3D from './components/Scatter3D';
import AnomalyTable from './components/AnomalyTable';
import DownloadSection from './components/DownloadSection';
import './App.css';

export default function App() {
  const [uploadResult, setUploadResult] = useState(null);
  const [runResult, setRunResult] = useState(null);
  const uploadRevision = useRef(0);

  const handleUploadStart = () => {
    uploadRevision.current += 1;
    setUploadResult(null);
    setRunResult(null);
  };

  const handleRunSuccess = (result, revision) => {
    if (revision === uploadRevision.current) setRunResult(result);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>P.C.A. — Peculiarity Catching Agent</h1>
        <p>Upload a CSV, run anomaly detection, and explore 3D projections and per-row explanations.</p>
      </header>

      <main className="main">
        <FileUpload
          onUploadStart={handleUploadStart}
          onUploadSuccess={setUploadResult}
        />
        <RunControls
          key={uploadRevision.current}
          uploadResult={uploadResult}
          uploadRevision={uploadRevision.current}
          onRunStart={() => setRunResult(null)}
          onRunSuccess={handleRunSuccess}
        />

        {runResult && (
          <>
            <section className="vizSection">
              <h2 className="vizTitle">
                3D view
                {runResult.n_components_used != null && (
                  <span className="vizMeta"> (PCA components used: {runResult.n_components_used})</span>
                )}
              </h2>
              <Scatter3D
                points3d={runResult.points_3d}
                labels={runResult.labels}
                anomalyDetails={runResult.anomaly_details}
              />
            </section>

            <AnomalyTable
              anomalyDetails={runResult.anomaly_details}
            />

            <DownloadSection datasetId={uploadResult.dataset_id} />
          </>
        )}
      </main>
    </div>
  );
}
