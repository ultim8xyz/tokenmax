/* Procedural member art, ported verbatim from the design study.
 *
 * Every routine is seeded, so the same member draws the same world on every
 * device and every reload. Canvas work is imperative by nature; this file keeps
 * that in one place so the React side never touches a 2D context.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const rng = (s: number) => () => {
  s |= 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function skyBed(c: any, w: number, h: number, hue: number, rand: () => number) {
  const sky = c.createLinearGradient(0, 0, w * 0.4, h);
  sky.addColorStop(0, `hsl(${hue}, 62%, 13%)`);
  sky.addColorStop(0.55, `hsl(${(hue + 26) % 360}, 54%, 8%)`);
  sky.addColorStop(1, `hsl(${hue}, 40%, 4%)`);
  c.fillStyle = sky; c.fillRect(0, 0, w, h);

  for (let i = 0; i < 90; i++) {
    const x = rand() * w, y = rand() * h, a = 0.12 + Math.pow(rand(), 2.4) * 0.8;
    c.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    const r = rand() < 0.14 ? 1.6 : 1;
    c.fillRect(x, y, r, r);
  }

  const neb = c.createRadialGradient(w * 0.76, h * 0.2, 0, w * 0.76, h * 0.2, w * 0.9);
  neb.addColorStop(0, `hsla(${(hue + 40) % 360}, 90%, 56%, 0.30)`);
  neb.addColorStop(1, "transparent");
  c.fillStyle = neb; c.fillRect(0, 0, w, h);
}

export function planetBody(c: any, cx: number, cy: number, R: number, hue: number, rand: () => number, { bands = 4, glow = 1.9 }: { bands?: number; glow?: number } = {}) {
  const g = c.createRadialGradient(cx - R * 0.42, cy - R * 0.46, R * 0.08, cx, cy, R * 1.12);
  g.addColorStop(0, `hsl(${hue}, 98%, 78%)`);
  g.addColorStop(0.42, `hsl(${hue}, 92%, 54%)`);
  g.addColorStop(1, `hsl(${(hue + 22) % 360}, 84%, 15%)`);
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fillStyle = g; c.fill();

  if (bands) {
    c.save();
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip();
    for (let i = 0; i < bands; i++) {
      const y = cy - R + rand() * R * 2;
      c.fillStyle = `hsl(${(hue + 12) % 360} 90% ${28 + rand() * 26}% / 0.28)`;
      c.fillRect(cx - R, y, R * 2, R * (0.06 + rand() * 0.13));
    }
    c.restore();
  }

  const halo = c.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * glow);
  halo.addColorStop(0, `hsla(${hue}, 98%, 62%, 0.34)`);
  halo.addColorStop(1, "transparent");
  c.fillStyle = halo;
  c.beginPath(); c.arc(cx, cy, R * glow, 0, Math.PI * 2); c.fill();
}

export function ring(c: any, cx: number, cy: number, R: number, hue: number, tilt: number, mul: number, front: boolean) {
  c.save();
  c.translate(cx, cy); c.rotate(tilt); c.scale(1, 0.26);
  c.beginPath();
  c.arc(0, 0, R * mul, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
  c.strokeStyle = `hsl(${(hue + 18) % 360} 98% ${front ? 80 : 72}% / ${front ? 0.9 : 0.55})`;
  c.lineWidth = R * 0.15; c.stroke();
  c.restore();
}

export function paintWorld(cv: any, hue: number, seed: number, scale = 1, kind = "regular") {
  const rand = rng(seed + 7);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  if (!w || !h) return;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  skyBed(c, w, h, hue, rand);

  const cx = w * 0.5, cy = h * 0.53, U = Math.min(w, h) * 0.29 * scale;

  if (kind === "swarm") {
    // Many bodies, none of them dominant.
    const n = 7 + Math.floor(rand() * 4);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.7;
      const d = U * (0.35 + rand() * 1.15);
      pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, U * (0.13 + rand() * 0.26)]);
    }
    c.strokeStyle = `hsla(${hue}, 96%, 70%, 0.28)`;
    c.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      c.beginPath(); c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[j][0], pts[j][1]); c.stroke();
    }
    for (const [x, y, rr] of pts) planetBody(c, x, y, rr, hue, rand, { bands: 0, glow: 2.4 });
    return;
  }

  if (kind === "heavy") {
    // One dense mass, no ring, a hard terminator and a bright limb.
    const R = U * 1.24;
    planetBody(c, cx, cy, R, hue, rand, { bands: 7, glow: 1.5 });
    c.save();
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip();
    const sh = c.createLinearGradient(cx - R, cy - R, cx + R * 0.9, cy + R);
    sh.addColorStop(0, "rgba(0,0,0,0)");
    sh.addColorStop(0.52, "rgba(0,0,0,0)");
    sh.addColorStop(1, "rgba(0,0,0,0.72)");
    c.fillStyle = sh; c.fillRect(cx - R, cy - R, R * 2, R * 2);
    c.restore();
    c.beginPath(); c.arc(cx, cy, R * 1.015, Math.PI * 1.05, Math.PI * 1.75);
    c.strokeStyle = `hsla(${hue}, 100%, 86%, 0.85)`; c.lineWidth = R * 0.035; c.stroke();
    return;
  }

  if (kind === "metronome") {
    // Evenly spaced orbits. Regularity drawn as regularity.
    for (let i = 4; i >= 1; i--) {
      c.save();
      c.translate(cx, cy); c.scale(1, 0.34);
      c.beginPath(); c.arc(0, 0, U * (0.55 + i * 0.42), 0, Math.PI * 2);
      c.strokeStyle = `hsla(${hue}, 92%, 72%, ${0.1 + i * 0.055})`;
      c.lineWidth = 1.2; c.stroke();
      c.restore();
      const a = rand() * Math.PI * 2, d = U * (0.55 + i * 0.42);
      c.beginPath();
      c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.34, U * 0.075, 0, Math.PI * 2);
      c.fillStyle = `hsl(${(hue + 40) % 360}, 70%, 78%)`; c.fill();
    }
    planetBody(c, cx, cy, U * 0.62, hue, rand, { bands: 3, glow: 2.2 });
    return;
  }

  if (kind === "fleet") {
    // A primary and a train of moons, one per machine.
    planetBody(c, cx, cy, U * 0.86, hue, rand, { bands: 4, glow: 2.0 });
    const n = 4 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const a = -0.5 + (i / n) * Math.PI * 1.7;
      const d = U * (1.5 + i * 0.24);
      const mx = cx + Math.cos(a) * d, my = cy + Math.sin(a) * d * 0.55;
      c.beginPath(); c.arc(mx, my, U * (0.16 - i * 0.017), 0, Math.PI * 2);
      c.fillStyle = `hsl(${(hue + 50) % 360}, 46%, ${72 - i * 5}%)`; c.fill();
    }
    return;
  }

  if (kind === "deep") {
    // A long tail. Depth drawn as reach.
    const a = -0.7;
    const g = c.createLinearGradient(cx, cy, cx - Math.cos(a) * w, cy - Math.sin(a) * h * 0.6);
    g.addColorStop(0, `hsla(${hue}, 98%, 72%, 0.62)`);
    g.addColorStop(1, "transparent");
    c.save();
    c.translate(cx, cy); c.rotate(a + Math.PI);
    c.beginPath(); c.moveTo(0, -U * 0.5); c.lineTo(w, -U * 0.06); c.lineTo(w, U * 0.06); c.lineTo(0, U * 0.5);
    c.closePath();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.restore();
    c.save();
    c.translate(cx, cy); c.rotate(a + Math.PI);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, -U * 0.55); c.quadraticCurveTo(w * 0.5, -U * 0.1, w, 0);
    c.quadraticCurveTo(w * 0.5, U * 0.1, 0, U * 0.55); c.closePath();
    c.fill();
    c.restore();
    planetBody(c, cx, cy, U * 0.66, hue, rand, { bands: 2, glow: 2.6 });
    return;
  }

  // Regular: one body, one ring.
  ring(c, cx, cy, U, hue, -0.42, 1.72, false);
  planetBody(c, cx, cy, U, hue, rand, { bands: 5, glow: 2.1 });
  ring(c, cx, cy, U, hue, -0.42, 1.72, true);
  const moons = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < moons; i++) {
    const a = rand() * Math.PI * 2, d = U * (1.9 + rand() * 0.7);
    c.beginPath();
    c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.5, U * (0.07 + rand() * 0.07), 0, Math.PI * 2);
    c.fillStyle = `hsl(${(hue + 60) % 360} 40% ${64 + rand() * 20}%)`; c.fill();
  }
}

export function paintMark(cv: any, hue: number, k: number) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  if (!w || !h) return;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, U = Math.min(w, h) * 0.5;

  // Six arcs closing into an aperture as the load completes.
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2;
    const span = (Math.PI / 3) * (0.32 + k * 0.6);
    const rr = U * (0.34 + i * 0.085);
    c.beginPath();
    c.arc(cx, cy, rr, a0 - span / 2, a0 + span / 2);
    c.strokeStyle = `hsla(${hue}, 96%, ${58 + i * 4}%, ${0.22 + k * 0.6})`;
    c.lineWidth = Math.max(1.2, U * 0.035);
    c.lineCap = "round";
    c.stroke();
  }
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, U * 0.42);
  g.addColorStop(0, `hsla(${hue}, 100%, 82%, ${0.18 + k * 0.7})`);
  g.addColorStop(1, "transparent");
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, U * 0.42, 0, Math.PI * 2); c.fill();
}

export function paintChart(cv: any, p: any) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  const padT = h * 0.34, padB = h * 0.16, padX = w * 0.035;
  const days = p.days;
  const peak = Math.max(1, ...days.map((d: any) => d.cost));
  const X = (i: number) => padX + (w - padX * 2) * (i / (days.length - 1));
  const Y = (v: number) => h - padB - (h - padT - padB) * (v / peak);

  const pts: [number, number][] = days.map((d: any, i: number) => [X(i), Y(d.cost)]);

  // Catmull-rom through the points, so the line has no corners.
  const path = new Path2D();
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? pts[i + 1];
    path.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    );
  }

  const fill = new Path2D(path);
  fill.lineTo(pts[pts.length - 1][0], h);
  fill.lineTo(pts[0][0], h);
  fill.closePath();

  const hue = p.hue;
  const g = c.createLinearGradient(0, padT, 0, h);
  g.addColorStop(0, `hsla(${hue}, 96%, 62%, 0.55)`);
  g.addColorStop(1, `hsla(${hue}, 96%, 56%, 0)`);
  c.fillStyle = g; c.fill(fill);

  c.strokeStyle = `hsl(${hue}, 98%, 76%)`;
  c.lineWidth = 2;
  c.lineJoin = "round";
  c.shadowColor = `hsla(${hue}, 98%, 62%, 0.9)`;
  c.shadowBlur = 16;
  c.stroke(path);
  c.shadowBlur = 0;

  // Mark the single biggest day and nothing else.
  const bi = days.reduce((b: number, d: any, i: number) => (d.cost > days[b].cost ? i : b), 0);
  c.beginPath(); c.arc(X(bi), Y(days[bi].cost), 4.5, 0, Math.PI * 2);
  c.fillStyle = "#fff"; c.fill();
  c.beginPath(); c.arc(X(bi), Y(days[bi].cost), 9, 0, Math.PI * 2);
  c.strokeStyle = `hsla(${hue}, 98%, 76%, 0.5)`; c.lineWidth = 1.5; c.stroke();

  c.font = "400 11px Archivo, sans-serif";
  c.fillStyle = "rgba(160,175,210,0.72)";
  c.textBaseline = "bottom";
  c.fillText(days[0].date, padX, h - 4);
  c.textAlign = "right";
  c.fillText("today", w - padX, h - 4);
}
