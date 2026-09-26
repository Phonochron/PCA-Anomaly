import { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import styles from './Scatter3D.module.css';

const NORMAL_COLOR = 0x6bcf7f;
const ANOMALY_COLOR = 0xe86c6c;
const AXIS_LENGTH = 2.5;

function normalizePoints(points3d) {
  if (!points3d?.length) return [];
  const flat = points3d.flat();
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < flat.length; i++) {
    const v = flat[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const scale = 4 / range;
  const cx = (min + max) / 2;
  const positions = [];
  for (const p of points3d) {
    positions.push((p[0] - cx) * scale, (p[1] - cx) * scale, (p[2] - cx) * scale);
  }
  return positions;
}

function addAxes(scene) {
  const origin = new THREE.Vector3(0, 0, 0);
  const dirX = new THREE.Vector3(1, 0, 0);
  const dirY = new THREE.Vector3(0, 1, 0);
  const dirZ = new THREE.Vector3(0, 0, 1);
  const arrowHelperX = new THREE.ArrowHelper(dirX, origin, AXIS_LENGTH, 0xe86c6c);
  const arrowHelperY = new THREE.ArrowHelper(dirY, origin, AXIS_LENGTH, 0x6bcf7f);
  const arrowHelperZ = new THREE.ArrowHelper(dirZ, origin, AXIS_LENGTH, 0x7c9eff);
  const arrows = [arrowHelperX, arrowHelperY, arrowHelperZ];
  scene.add(...arrows);
  return () => {
    for (const arrow of arrows) {
      scene.remove(arrow);
      // ArrowHelper geometries are shared by Three.js; only materials are per instance.
      arrow.line.material.dispose();
      arrow.cone.material.dispose();
    }
  };
}

export default function Scatter3D({
  points3d = [],
  labels = [],
  anomalyDetails = [],
}) {
  const containerRef = useRef(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const positions = useMemo(
    () => normalizePoints(points3d),
    [points3d]
  );

  const colors = useMemo(() => {
    const c = new Float32Array(labels.length * 3);
    const norm = new THREE.Color(NORMAL_COLOR);
    const anom = new THREE.Color(ANOMALY_COLOR);
    for (let i = 0; i < labels.length; i++) {
      const col = labels[i] === 1 ? anom : norm;
      c[i * 3] = col.r;
      c[i * 3 + 1] = col.g;
      c[i * 3 + 2] = col.b;
    }
    return c;
  }, [labels]);

  useEffect(() => {
    if (!containerRef.current || positions.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0f14);
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(5, 5, 5);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    const material = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const disposeAxes = addAxes(scene);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(points);
      if (intersects.length > 0 && intersects[0].index !== undefined) {
        setHoveredIndex(intersects[0].index);
        setTooltipPos({ x: event.clientX, y: event.clientY });
      } else {
        setHoveredIndex(null);
      }
    };

    const onPointerLeave = () => setHoveredIndex(null);

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      disposeAxes();
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [positions, colors]);

  const tooltipData = hoveredIndex != null && anomalyDetails[hoveredIndex] != null
    ? anomalyDetails[hoveredIndex]
    : null;

  if (!points3d?.length) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.placeholder}>Run PCA to see 3D visualization</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.legend}>
        <span><i style={{ color: 'var(--normal)' }} /> Normal</span>
        <span><i style={{ color: 'var(--anomaly)' }} /> Anomaly</span>
      </div>
      <div className={styles.axisLabels}>
        <span className={styles.axisX}>PC1 (X)</span>
        <span className={styles.axisY}>PC2 (Y)</span>
        <span className={styles.axisZ}>PC3 (Z)</span>
      </div>
      <div ref={containerRef} className={styles.canvas} />
      {tooltipData != null && (
        <div
          className={styles.tooltip}
          style={{
            left: Math.min(tooltipPos.x + 12, window.innerWidth - 260),
            top: Math.min(tooltipPos.y + 12, window.innerHeight - 220),
          }}
        >
          <div className={styles.tooltipRow}>
            <strong>Row</strong> {tooltipData.row_index + 1}
          </div>
          <div className={styles.tooltipRow}>
            <strong>Status</strong>{' '}
            <span className={tooltipData.is_anomaly ? styles.tooltipAnomaly : styles.tooltipNormal}>
              {tooltipData.is_anomaly ? 'Anomaly' : 'Normal'}
            </span>
          </div>
          <div className={styles.tooltipRow}>
            <strong>Reconstruction error</strong>{' '}
            {typeof tooltipData.reconstruction_error === 'number'
              ? tooltipData.reconstruction_error.toFixed(6)
              : tooltipData.reconstruction_error}
          </div>
          {tooltipData.top_features?.length > 0 && (
            <div className={styles.tooltipFeatures}>
              <strong>Top features</strong>
              <ul>
                {tooltipData.top_features.slice(0, 3).map((f, i) => (
                  <li key={i}>
                    {f.name}: {typeof f.contribution === 'number' ? f.contribution.toFixed(4) : f.contribution}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
