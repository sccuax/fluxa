import { useEffect, useRef } from "react";
import * as THREE from "three";

// Parses a hex color to raw sRGB 0-1 components, deliberately *not* via
// `new THREE.Color(hex)`: three.js's automatic color management (on by
// default since r152) treats that as sRGB and immediately converts it to
// *linear* working-space values for lighting math. This shader isn't doing
// any lighting - it's a direct port of the CSS gradient's own naive sRGB
// channel interpolation (`mix()` in rampColor below) - so feeding it
// linearized values made the mix() blend happen in the wrong space
// (colors read as noticeably brighter/more saturated than the real
// gradient, closer to raw "RGB primaries" than the intended sRGB look).
// Pairs with `renderer.outputColorSpace = THREE.LinearSRGBColorSpace`
// below, which stops the renderer from re-encoding this shader's already-
// final output on the way out.
function hexToRGB01(hex: string): THREE.Vector3 {
  const int = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

// Same five stops as the `gradient-gradient` design token (see
// packages/design-tokens/tokens/*.json -> the --gradient-gradient CSS var) -
// redrawn here as GLSL uniforms because a shader needs real color values and
// numeric stop positions, not a CSS background-image string. Mirrors the
// GRADIENT_STOPS pattern already used in Svg3DPreview.tsx for the same
// brand gradient.
const STOPS: [number, THREE.Vector3][] = [
  [0.084, hexToRGB01("#6ff5f1")],
  [0.296, hexToRGB01("#3b9cd6")],
  [0.5, hexToRGB01("#0955e5")],
  [0.708, hexToRGB01("#8e54c5")],
  [0.916, hexToRGB01("#e23f8c")],
];

// The token's actual CSS angle (`linear-gradient(3deg, ...)`), needed to
// reproduce the exact same gradient-line projection the browser uses for
// the real CSS gradient - see uWidth/uHeight below for why this has to be
// aspect-ratio aware rather than a flat uv.x/uv.y approximation.
const GRADIENT_ANGLE_DEG = 3;

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uWidth;
  uniform float uHeight;
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;

  vec3 rampColor(float t) {
    t = clamp(t, 0.0, 1.0);
    // SOFTNESS widens each blend well past the literal gap between two
    // stops (e.g. 0.296 -> 0.5 becomes 0.296-SOFTNESS -> 0.5+SOFTNESS) -
    // matching the stops exactly (as a strict CSS port would) made each
    // fade only a few pixels wide at this button's real size, which read
    // as almost no blending at all between colors. Sequential mix() calls
    // (each overwriting c with its own smoothstep progress) build up the
    // ramp correctly across the widened, overlapping regions.
    float softness = 0.1;
    vec3 c = uColor0;
    c = mix(c, uColor1, smoothstep(0.084 - softness, 0.296 + softness, t));
    c = mix(c, uColor2, smoothstep(0.296 - softness, 0.5 + softness, t));
    c = mix(c, uColor3, smoothstep(0.5 - softness, 0.708 + softness, t));
    c = mix(c, uColor4, smoothstep(0.708 - softness, 0.916 + softness, t));
    return c;
  }

  void main() {
    // Reproduces the CSS linear-gradient(3deg, ...) box projection exactly
    // (angle measured clockwise from straight up, per the CSS spec, and
    // aspect-ratio aware via uWidth/uHeight) rather than a flat uv.y
    // approximation. This makes the shader's zero-wave state pixel-
    // identical to the real gradient the button starts from, so easing
    // uIntensity up from 0 grows the ripple *out of the actual rest
    // state* instead of cross-fading into a slightly different-looking
    // gradient - which is what read as "desfasado" before.
    float angle = radians(${GRADIENT_ANGLE_DEG.toFixed(1)});
    float len = abs(uWidth * sin(angle)) + abs(uHeight * cos(angle));
    float cssX = vUv.x * uWidth;
    float cssY = (1.0 - vUv.y) * uHeight; // CSS y grows downward; UV.y grows upward
    float tBase = 0.5 + ((cssX - uWidth * 0.5) * sin(angle) - (cssY - uHeight * 0.5) * cos(angle)) / len;

    // Two overlapping sine waves at different frequencies/speeds so the
    // ripple reads as rolling dunes rather than one uniform oscillation.
    // This is a domain warp (it perturbs *where in the gradient ramp* a
    // pixel samples from) rather than a screen-space displacement, so it
    // never moves the pixel's actual on-screen position - only its color.
    float wave = sin(vUv.x * 5.0 + uTime * 1.1) * 0.05
               + sin(vUv.x * 11.0 - uTime * 1.7) * 0.025;

    float t = tBase + wave * uIntensity;
    gl_FragColor = vec4(rampColor(t), 1.0);
  }
`;

interface LiquidGradientBackgroundProps {
  // Whether the hover ripple should be running. uIntensity eases toward
  // this each frame from whatever value it's *currently* at (see the lerp
  // in animate() below) rather than jumping or restarting from 0 - so a
  // hover-out mid-ripple settles back down continuously from wherever the
  // wave currently is, landing exactly on the calibrated zero-wave state
  // (which, per the tBase formula above, is pixel-identical to the plain
  // gradient) instead of snapping back. This canvas never draws button
  // text - it's a background-only layer, confined by the button's own
  // `overflow-hidden`.
  active: boolean;
}

export function LiquidGradientBackground({ active }: LiquidGradientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // The fragment shader already outputs final sRGB-encoded byte values
    // (see hexToRGB01 above) - LinearSRGBColorSpace here just means "don't
    // re-encode what I already handed you," not "render in linear light".
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uWidth: { value: 1 },
        uHeight: { value: 1 },
        uColor0: { value: STOPS[0][1] },
        uColor1: { value: STOPS[1][1] },
        uColor2: { value: STOPS[2][1] },
        uColor3: { value: STOPS[3][1] },
        uColor4: { value: STOPS[4][1] },
      },
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      renderer.setSize(rect.width, rect.height, false);
      material.uniforms.uWidth.value = rect.width;
      material.uniforms.uHeight.value = rect.height;
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const clock = new THREE.Clock();
    let rafId = requestAnimationFrame(animate);

    function animate() {
      const target = activeRef.current ? 1 : 0;
      material.uniforms.uIntensity.value += (target - material.uniforms.uIntensity.value) * 0.08;
      material.uniforms.uTime.value += clock.getDelta();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
