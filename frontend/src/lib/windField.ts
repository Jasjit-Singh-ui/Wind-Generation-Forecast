// Decorative wind-flow background: particles drift along a smooth, slowly changing flow field
// and leave short fading trails, like a wind map. Simulation and drawing live here (pure,
// framework-free); components/WindBackdrop.tsx owns the canvas and the animation loop.

export const TRAIL = 28; // positions kept per particle (about 1 s at the 30 fps draw rate)
export const FRAME_RATE = 30; // the backdrop is drawn at 30 fps: smooth enough, half the work
const BASE_SPEED_PX_S = 95;
const AREA_PER_PARTICLE = 5200; // px² of viewport per particle
const MIN_PARTICLES = 90;
const MAX_PARTICLES = 420;
const TEAL_SHARE = 0.18;
const SCALE_PX = 340; // size of the flow's swirls

export interface WindField {
  width: number;
  height: number;
  count: number;
  /** Ring buffers, `TRAIL` slots per particle; all particles advance in lockstep. */
  xs: Float32Array;
  ys: Float32Array;
  head: number;
  /** Valid points in each particle's trail (reset when it respawns). */
  filled: Uint8Array;
  age: Float32Array;
  life: Float32Array;
  /** 0 = pale blue streak, 1 = teal accent. */
  tone: Uint8Array;
}

/** Direction of the wind (radians) at a point: a westerly that meanders in slowly drifting swirls. */
export function flowAngle(x: number, y: number, t: number): number {
  const nx = x / SCALE_PX;
  const ny = y / SCALE_PX;
  return (
    0.02 +
    0.3 * Math.sin(ny * 3.6 + nx * 1.2 + t * 0.12) +
    0.18 * Math.sin(nx * 2.4 - t * 0.08) * Math.cos(ny * 2.2 + t * 0.06) +
    0.1 * Math.cos((nx - ny) * 4 + t * 0.15)
  );
}

/** Relative wind speed at a point, between 0.65 and 1 (gusts drift through the field). */
export function flowSpeed(x: number, y: number, t: number): number {
  return 0.65 + 0.35 * (0.5 + 0.5 * Math.sin((x / SCALE_PX) * 1.4 + (y / SCALE_PX) * 1.8 + t * 0.09));
}

export function createField(width: number, height: number, rand: () => number = Math.random): WindField {
  const count = Math.max(MIN_PARTICLES, Math.min(MAX_PARTICLES, Math.round((width * height) / AREA_PER_PARTICLE)));
  const field: WindField = {
    width,
    height,
    count,
    xs: new Float32Array(count * TRAIL),
    ys: new Float32Array(count * TRAIL),
    head: 0,
    filled: new Uint8Array(count),
    age: new Float32Array(count),
    life: new Float32Array(count),
    tone: new Uint8Array(count),
  };
  for (let p = 0; p < count; p++) {
    respawn(field, p, rand, true);
    field.tone[p] = rand() < TEAL_SHARE ? 1 : 0;
  }
  return field;
}

function respawn(field: WindField, p: number, rand: () => number, anywhere: boolean): void {
  const slot = p * TRAIL + field.head;
  // Mostly reappear anywhere (so the field stays evenly filled), sometimes enter from the west.
  field.xs[slot] = anywhere || rand() < 0.7 ? rand() * field.width : -10;
  field.ys[slot] = rand() * field.height;
  field.filled[p] = 1;
  field.life[p] = 2.5 + rand() * 4.5;
  field.age[p] = anywhere ? rand() * field.life[p] : 0;
}

/** Advance every particle by `dt` seconds at time `t`. */
export function stepField(field: WindField, t: number, dt: number, rand: () => number = Math.random): void {
  const previous = field.head;
  const next = (previous + 1) % TRAIL;
  field.head = next;
  for (let p = 0; p < field.count; p++) {
    const base = p * TRAIL;
    const x = field.xs[base + previous];
    const y = field.ys[base + previous];
    const angle = flowAngle(x, y, t);
    const distance = BASE_SPEED_PX_S * flowSpeed(x, y, t) * dt;
    const nx = x + Math.cos(angle) * distance;
    const ny = y + Math.sin(angle) * distance;
    field.age[p] += dt;
    const outside = nx > field.width + 40 || nx < -40 || ny < -40 || ny > field.height + 40;
    if (outside || field.age[p] > field.life[p]) {
      respawn(field, p, rand, false);
    } else {
      field.xs[base + next] = nx;
      field.ys[base + next] = ny;
      field.filled[p] = Math.min(TRAIL, field.filled[p] + 1);
    }
  }
}

const TONES = ["160, 198, 255", "94, 230, 201"];
const BUCKET_ALPHA = [0.05, 0.13, 0.3]; // tail -> head

/** Draw all trails with three alpha steps per tone (six strokes per frame, however many particles). */
export function drawField(ctx: CanvasRenderingContext2D, field: WindField): void {
  ctx.clearRect(0, 0, field.width, field.height);
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  for (let tone = 0; tone < TONES.length; tone++) {
    const paths = [new Path2D(), new Path2D(), new Path2D()];
    for (let p = 0; p < field.count; p++) {
      const points = field.filled[p];
      if (field.tone[p] !== tone || points < 2) continue;
      const base = p * TRAIL;
      for (let k = 0; k < points - 1; k++) {
        const from = (field.head - (points - 1) + k + TRAIL) % TRAIL;
        const to = (from + 1) % TRAIL;
        const path = paths[Math.min(2, Math.floor((k / (points - 1)) * 3))];
        path.moveTo(field.xs[base + from], field.ys[base + from]);
        path.lineTo(field.xs[base + to], field.ys[base + to]);
      }
    }
    paths.forEach((path, bucket) => {
      ctx.strokeStyle = `rgba(${TONES[tone]}, ${BUCKET_ALPHA[bucket] * (tone === 1 ? 0.85 : 1)})`;
      ctx.stroke(path);
    });
  }
}
