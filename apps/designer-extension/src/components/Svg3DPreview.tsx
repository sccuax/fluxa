import { useEffect, useRef } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import gsap from "gsap";

// SVG original (viewBox 0 0 49 49)
const SVG_MARKUP = `<svg><path d="M48.1599 36.1218C48.1599 42.775 42.7674 48.1599 36.1218 48.1599C29.4762 48.1599 24.0837 42.7674 24.0837 36.1218C24.0837 42.775 18.6913 48.1599 12.0457 48.1599C5.40004 48.1599 0 42.7674 0 36.1218C0 29.4762 5.39245 24.0837 12.0381 24.0837C5.39245 24.0762 0 18.6913 0 12.0381C0 8.71147 1.34432 5.70385 3.52408 3.52408C5.70385 1.34432 8.71147 0 12.0381 0H36.1142C42.7598 0 48.1523 5.39245 48.1523 12.0381C48.1523 15.3647 46.808 18.3723 44.6282 20.5521C42.4485 22.7318 39.4408 24.0762 36.1142 24.0762C42.7598 24.0762 48.1523 29.4686 48.1523 36.1142L48.1599 36.1218Z"/></svg>`;

// Stops copiados del linearGradient original (paint0_linear_61_2832)
const GRADIENT_STOPS = [
  { t: 0, c: new THREE.Color("#6FF5F1") },
  { t: 0.3, c: new THREE.Color("#3B9DD6") },
  { t: 0.504808, c: new THREE.Color("#0644BB") },
  { t: 0.701923, c: new THREE.Color("#7442A4") },
  { t: 1, c: new THREE.Color("#E23F8C") },
];

function gradientColorAt(t: number) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    const a = GRADIENT_STOPS[i];
    const b = GRADIENT_STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const localT = (t - a.t) / (b.t - a.t);
      return a.c.clone().lerp(b.c, localT);
    }
  }
  return GRADIENT_STOPS[GRADIENT_STOPS.length - 1].c.clone();
}

// Matches SVG_MARKUP's viewBox (49x49) so the canvas is exactly as tall as it is wide.
const ASPECT_RATIO = 1;

// Camera distance so a sphere of `radius` renders at AT MOST `maxPx` pixels
// (diameter) on a canvas `canvasHeightPx` tall, for a camera with the given
// vertical field of view. Uses the sphere's tangent-line angle (asin), which
// bounds the object's silhouette at every possible orientation - so, unlike
// sizing for a single flat/front-on view, this guarantees the object never
// exceeds the frame no matter how it's rotated (it auto-rotates on Y forever
// and can be dragged on X/Y too). A small margin keeps it just shy of the
// true edge instead of exactly tangent to it.
const SAFETY_MARGIN = 1.05;

function distanceForMaxPixelSize(
  radius: number,
  canvasHeightPx: number,
  maxPx: number,
  verticalFovRad: number,
) {
  const ndcRadius = (maxPx * SAFETY_MARGIN) / canvasHeightPx;
  const silhouetteHalfAngle = Math.atan(ndcRadius * Math.tan(verticalFovRad / 2));
  return radius / Math.sin(silhouetteHalfAngle);
}

interface Svg3DPreviewProps {
  /**
   * Upper bound on the logo's rendered size in real screen pixels (its
   * diameter). Guaranteed never to be exceeded at any rotation angle - the
   * logo will render smaller than this head-on, since it's an irregular
   * (non-spherical) shape and this sizes for its worst-case silhouette.
   */
  objectSize: number;
  depth?: number;
  bevelThickness?: number;
  bevelSize?: number;
  autoRotateSpeed?: number;
}

export function Svg3DPreview({
  objectSize,
  depth = 7,
  bevelThickness = 1.2,
  bevelSize = 0.6,
  autoRotateSpeed = 0.004,
}: Svg3DPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.cursor = "grab";

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const light1 = new THREE.DirectionalLight(0xffffff, 1);
    light1.position.set(1, 1, 1);
    scene.add(light1);
    const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
    light2.position.set(-1, -0.5, 0.5);
    scene.add(light2);

    // --- Parsear SVG y extruir ---
    const loader = new SVGLoader();
    const data = loader.parse(SVG_MARKUP);
    const group = new THREE.Group();

    data.paths.forEach((path) => {
      const shapes = SVGLoader.createShapes(path);
      shapes.forEach((shape) => {
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelThickness,
          bevelSize,
          bevelSegments: 4,
          curveSegments: 32,
        });
        geometry.center();

        // Degradado por vértice a lo largo de la diagonal (aproxima el linearGradient del SVG)
        const pos = geometry.attributes.position;
        const dx = Math.SQRT1_2;
        const dy = Math.SQRT1_2;
        let minP = Infinity;
        let maxP = -Infinity;
        const projs = new Array<number>(pos.count);
        for (let i = 0; i < pos.count; i++) {
          const p = pos.getX(i) * dx + pos.getY(i) * dy;
          projs[i] = p;
          if (p < minP) minP = p;
          if (p > maxP) maxP = p;
        }
        const colors = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
          const t = (projs[i] - minP) / (maxP - minP);
          const col = gradientColorAt(t);
          colors[i * 3] = col.r;
          colors[i * 3 + 1] = col.g;
          colors[i * 3 + 2] = col.b;
        }
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

        const material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          metalness: 0.25,
          roughness: 0.35,
          side: THREE.DoubleSide,
        });
        group.add(new THREE.Mesh(geometry, material));
      });
    });

    // El eje Y de SVG está invertido respecto a three.js
    group.scale.y *= -1;
    scene.add(group);

    // Encuadra la cámara según la esfera envolvente completa del grupo (ancho,
    // alto y profundidad del relieve) para que el logo jamás se salga del
    // canvas sin importar el ángulo de rotación en X o Y.
    const sphere = new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere());
    const verticalFov = (camera.fov * Math.PI) / 180;

    const positionCamera = (canvasHeightPx: number) => {
      const distance = distanceForMaxPixelSize(sphere.radius, canvasHeightPx, objectSize, verticalFov);
      camera.position.set(sphere.center.x, sphere.center.y, sphere.center.z + distance);
      camera.lookAt(sphere.center);
    };
    positionCamera(height);

    // Entrance: pop in from scale 0 with a bounce, plus a small extra spin that
    // decays into the normal auto-rotate. Camera framing above was measured
    // against the group's real rest scale/pose - only *after* that do we zero
    // the scale to animate in, so the framing itself is never computed against
    // a collapsed (scale 0) bounding sphere.
    const restScale = group.scale.clone();
    group.scale.set(0, 0, 0);
    const entrySpin = { extra: -0.55 };
    const entranceScaleTween = gsap.to(group.scale, {
      x: restScale.x,
      y: restScale.y,
      z: restScale.z,
      duration: 0.55,
      ease: "back.out(1.8)",
    });
    const entranceSpinTween = gsap.to(entrySpin, {
      extra: 0,
      duration: 0.55,
      ease: "back.out(1.6)",
    });

    // --- Rotación con drag + auto-rotate ---
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let rotY = 0.5;
    let rotX = -0.35;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
      renderer.domElement.style.cursor = "grabbing";
    };
    const onPointerUp = () => {
      isDragging = false;
      renderer.domElement.style.cursor = "grab";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx2 = e.clientX - prevX;
      const dy2 = e.clientY - prevY;
      rotY += dx2 * 0.01;
      rotX += dy2 * 0.01;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (!isDragging) rotY += autoRotateSpeed;
      group.rotation.y = rotY + entrySpin.extra;
      group.rotation.x = rotX;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      positionCamera(h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      entranceScaleTween.kill();
      entranceSpinTween.kill();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      container.removeChild(renderer.domElement);

      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [objectSize, depth, bevelThickness, bevelSize, autoRotateSpeed]);

  return <div ref={containerRef} style={{ width: "100%", aspectRatio: ASPECT_RATIO }} />;
}
