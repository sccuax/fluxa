// A GPU-compute particle flow field. 100% of the simulation runs in a compute
// shader (positions/velocities never come back to the CPU) and the same storage
// buffer is drawn as instanced soft quads. See ../README.md for how it works,
// the tuning knobs, and the looks that were tried and rejected.
import type { StageHandle, StageOptions } from "./types";

const PARTICLE_COUNT = 60_000;
const WORKGROUP_SIZE = 64;
const MAX_DPR = 1.5;

// Particle = pos(vec2) + vel(vec2) => 16 bytes.
const PARTICLE_STRIDE = 16;

const COMPUTE_WGSL = /* wgsl */ `
struct Particle { pos: vec2f, vel: vec2f };
struct Params {
  time: f32, dt: f32, aspect: f32, _pad: f32,
  pointer: vec2f, pointerStrength: f32, _pad2: f32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Params;

fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

// Cheap flow: a rotating angle field, no noise texture. Particles converge
// onto thin bright filaments, which is the intended look (crisp, high contrast).
fn flow(p: vec2f, t: f32) -> vec2f {
  let a = sin(p.x * 2.3 + t * 0.35) + cos(p.y * 2.7 - t * 0.28) + sin((p.x + p.y) * 1.7 + t * 0.2);
  let ang = a * 1.5707963;
  return vec2f(cos(ang), sin(ang));
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&particles)) { return; }

  var p = particles[i];
  var force = flow(p.pos, params.time) * 0.22;

  // Pointer repulsion, aspect-corrected so the influence is circular.
  let d = (p.pos - params.pointer) * vec2f(params.aspect, 1.0);
  let dist = length(d);
  if (params.pointerStrength > 0.0 && dist < 0.35) {
    force += normalize(d + vec2f(1e-4)) * (0.35 - dist) * 2.4 * params.pointerStrength;
  }

  p.vel = mix(p.vel, force, 1.0 - exp(-params.dt * 2.5));
  p.pos += p.vel * params.dt;

  // Respawn on leaving the field, at a hashed position (no branching cost).
  if (abs(p.pos.x) > 1.05 || abs(p.pos.y) > 1.05) {
    let s = vec2f(f32(i) * 0.013, params.time);
    p.pos = vec2f(hash(s) * 2.0 - 1.0, hash(s + 7.7) * 2.0 - 1.0);
    p.vel = vec2f(0.0);
  }
  particles[i] = p;
}
`;

const RENDER_WGSL = /* wgsl */ `
struct Params {
  time: f32, dt: f32, aspect: f32, _pad: f32,
  pointer: vec2f, pointerStrength: f32, _pad2: f32,
};
@group(0) @binding(0) var<uniform> params: Params;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) speed: f32,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, @location(0) pos: vec2f, @location(1) vel: vec2f) -> VSOut {
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
  );
  let c = corners[vi];
  let size = 0.0035;
  var out: VSOut;
  out.position = vec4f(pos + vec2f(c.x / params.aspect, c.y) * size, 0.0, 1.0);
  out.uv = c;
  out.speed = clamp(length(vel) * 2.2, 0.0, 1.0);
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let r = length(in.uv);
  if (r > 1.0) { discard; }
  let soft = 1.0 - r * r;
  // Brand accent (#e23f8c) -> accent-2 (#6ff5f1) by speed.
  let slow = vec3f(0.886, 0.247, 0.549);
  let fast = vec3f(0.435, 0.961, 0.945);
  let col = mix(slow, fast, in.speed);
  let a = soft * (0.25 + 0.5 * in.speed);
  return vec4f(col * a, a);
}
`;

export async function mountWebgpuField(
  canvas: HTMLCanvasElement,
  options: StageOptions = {},
): Promise<StageHandle> {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No WebGPU adapter");
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("No WebGPU canvas context");

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });

  // ---- buffers ----
  const initial = new Float32Array(PARTICLE_COUNT * 4);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    initial[i * 4] = Math.random() * 2 - 1;
    initial[i * 4 + 1] = Math.random() * 2 - 1;
  }
  const particleBuffer = device.createBuffer({
    size: PARTICLE_COUNT * PARTICLE_STRIDE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(particleBuffer, 0, initial);

  const params = new Float32Array(8);
  const paramsBuffer = device.createBuffer({
    size: params.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // ---- pipelines ----
  const computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module: device.createShaderModule({ code: COMPUTE_WGSL }), entryPoint: "main" },
  });
  const computeBind = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: paramsBuffer } },
    ],
  });

  const renderModule = device.createShaderModule({ code: RENDER_WGSL });
  const renderPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: renderModule,
      entryPoint: "vs",
      buffers: [
        {
          arrayStride: PARTICLE_STRIDE,
          stepMode: "instance",
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" },
            { shaderLocation: 1, offset: 8, format: "float32x2" },
          ],
        },
      ],
    },
    fragment: {
      module: renderModule,
      entryPoint: "fs",
      targets: [
        {
          format,
          blend: {
            color: { srcFactor: "one", dstFactor: "one", operation: "add" },
            alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list" },
  });
  const renderBind = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: paramsBuffer } }],
  });

  // ---- size / pointer ----
  let aspect = 1;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    aspect = w / h;
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  let pointerX = 0;
  let pointerY = 0;
  let pointerStrength = 0;
  // window-level (not canvas-level): the canvas sits behind page content, the
  // same trap documented for the product's glassLiquid cursor tracker.
  const onMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    pointerStrength = inside ? 1 : 0;
    pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  // ---- loop ----
  let rafId = 0;
  let running = false;
  let last = performance.now();
  let elapsed = 0;

  const frame = (now: number) => {
    if (!running) return;
    // Clamp dt so a background tab / hitch never teleports the whole field.
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    elapsed += dt;

    params[0] = elapsed;
    params[1] = dt;
    params[2] = aspect;
    params[4] = pointerX;
    params[5] = pointerY;
    params[6] = pointerStrength;
    device.queue.writeBuffer(paramsBuffer, 0, params);

    const encoder = device.createCommandEncoder();
    const compute = encoder.beginComputePass();
    compute.setPipeline(computePipeline);
    compute.setBindGroup(0, computeBind);
    compute.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / WORKGROUP_SIZE));
    compute.end();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(renderPipeline);
    pass.setBindGroup(0, renderBind);
    pass.setVertexBuffer(0, particleBuffer);
    pass.draw(6, PARTICLE_COUNT);
    pass.end();
    device.queue.submit([encoder.finish()]);

    rafId = requestAnimationFrame(frame);
  };

  const resume = () => {
    if (running) return;
    running = true;
    last = performance.now(); // discard the paused gap, like the renderers' resume()
    rafId = requestAnimationFrame(frame);
  };
  const pause = () => {
    running = false;
    cancelAnimationFrame(rafId);
  };

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    pause();
    window.removeEventListener("pointermove", onMove);
    resizeObserver.disconnect();
    particleBuffer.destroy();
    paramsBuffer.destroy();
    device.destroy();
  };

  void device.lost.then((info) => {
    if (disposed) return; // our own destroy() also resolves `lost`
    pause();
    console.warn("[website] WebGPU device lost:", info.message);
    options.onLost?.();
  });

  resume();
  return { pause, resume, dispose };
}
