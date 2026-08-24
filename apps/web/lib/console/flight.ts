/* The arrival, ported from the design study.
 *
 * Isolated on purpose: it is the screen the study keeps revising, so it is kept
 * behind a single entry point that the onboarding page calls and nothing else
 * touches. Re-extracting it is one script.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { rng } from "./art";

export interface FlightOptions {
  /** The #flight container: a canvas plus an .arrive block. */
  host: HTMLElement;
  /** The form being pulled into the vanishing point, one child at a time. */
  form: HTMLElement;
  name: string;
  subtitle: string;
  hue: number;
}

function makeSpring({ stiffness = 150, damping = 15, mass = 1, from = 0, to = 1 } = {}) {
  let x = from, v = 0;
  return {
    get value() { return x; },
    get done() { return Math.abs(to - x) < 0.001 && Math.abs(v) < 0.001; },
    step(dt: number) {
      const h = Math.min(dt, 1 / 30);           // never integrate a long frame
      const a = (-stiffness * (x - to) - damping * v) / mass;
      v += a * h;
      x += v * h;
      return x;
    },
  };
}

function springIn(el: HTMLElement, delay = 0) {
  const s = makeSpring({ stiffness: 120, damping: 13, from: 0, to: 1 });
  let last: number | null = null;
  const run = (now: number) => {
    if (last === null) last = now;
    s.step((now - last) / 1000);
    last = now;
    const k = s.value;
    el.style.opacity = String(Math.min(1, Math.max(0, k * 1.6)));
    el.style.transform = `scale(${(0.06 + k * 0.94).toFixed(4)})`;
    el.style.filter = k < 0.85 ? `blur(${((1 - k) * 7).toFixed(2)}px)` : "none";
    if (!s.done) requestAnimationFrame(run);
    else { el.style.transform = "none"; el.style.filter = "none"; el.style.opacity = "1"; }
  };
  setTimeout(() => requestAnimationFrame(run), delay);
}

export function runFlight(opts: FlightOptions) {
  const host = opts.host;
  const cv = host.querySelector("canvas") as HTMLCanvasElement;
  const c = cv.getContext("2d")!;
  const wrap = opts.form;
  const shell = document.getElementById("shell") ?? document.createElement("div");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // rAF does not fire in a hidden tab, and a visitor who switches away mid
  // flight came back to a frozen tunnel and a watchdog landing. Drive on a
  // timer while hidden so the ride runs to its end either way.
  const schedule = (fn: (t: number) => void) => document.hidden
    ? setTimeout(() => fn(performance.now()), 1000 / 30)
    : requestAnimationFrame(fn);

  host.classList.add("on");
  document.body.classList.add("flying");
  schedule(() => host.classList.add("lit"));

  let landed = false;
  const welcomeEl = host.querySelector("h2");
  const subEl = host.querySelector("p");
  const land = () => {
    if (landed) return;
    landed = true;
    // The app stays unrendered behind this. It appears when Enter is pressed.
    if (welcomeEl) welcomeEl.textContent = `Welcome, ${opts.name}`;
    if (subEl) subEl.textContent = opts.subtitle;
    host.classList.add("over", "landed");
    shell.classList.add("gone");
    const arrive = host.querySelector(".arrive");
    if (arrive) [...arrive.children].forEach((el, i) => springIn(el as HTMLElement, i * 140));
  };

  if (reduce) { land(); return; }

  let W = 0, H = 0, dpr = 1;
  const fit = (): void => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit();
  addEventListener("resize", fit);

  // The backdrop's own stars are the ones that get collected, so the sequence
  // starts in the room the visitor is already in.
  const ambient = rng(4242);
  const seeded = Array.from({ length: 190 }, () => ({ x: ambient(), y: ambient() }));

  const rand = rng(9091);
  const DEPTH = 2600, R = 520;

  // Two incommensurate frequencies per axis, so the tunnel never repeats a
  // bend inside one flight. Amplitudes are in tunnel units against R = 520 —
  // large enough that a turn swings the mouth well off centre.
  const axis = (z: number): [number, number] => [
    Math.sin(z * 0.00150) * 148 + Math.sin(z * 0.00058) * 96,
    Math.cos(z * 0.00121) * 126 + Math.cos(z * 0.00041) * 74,
  ];

  // No ribs. The tunnel is only ever density — a thick shell of motes with a
  // few brighter lights in it, and the shape comes from where they are.
  const mote = (from: any) => {
    // A narrow shell. Filling the interior reads as a nebula; a thin wall
    // reads as a tunnel, and that is the whole job now the ribs are gone.
    const band = 1 - Math.pow(rand(), 2.2);
    return {
      a: rand() * Math.PI * 2,
      r: R * (0.80 + band * 0.26),
      z: 30 + rand() * DEPTH,
      tint: rand() < 0.34,
      w: 0.45 + rand() * 1.1,
      from: from || null,
    };
  };
  const motes = seeded.map((s) => mote(s));
  for (let i = 0; i < 3200; i++) motes.push(mote(null));

  const lights = Array.from({ length: 30 }, () => ({
    a: rand() * Math.PI * 2,
    r: R * (0.9 + rand() * 0.16),
    z: rand() * DEPTH,
    s: 10 + rand() * 22,
  }));

  // gather · the fields go, one at a time, while the pull is already on · arrival
  const GATHER = 1100;
  const kids = [...wrap.children] as HTMLElement[];
  const EXIT_STEP = 190;                 // one at a time, and unhurried

  // Each field is given mass. A big control is heavy: it takes longer to let go
  // of, it leans in early and arrives late, and it lands nearer the mouth. A
  // small label is light: it hangs, then snaps. One duration and one curve for
  // all seven read as seven copies of the same event, which is what a vacuum is
  // not.
  const EASES = [
    "cubic-bezier(0.88, 0, 1, 0.18)",     // light — hangs, then goes all at once
    "cubic-bezier(0.72, 0, 0.97, 0.22)",
    "cubic-bezier(0.46, 0, 0.82, 0.38)",  // heavy — leans in early, arrives late
  ];
  const boxes = kids.map((k) => k.getBoundingClientRect());
  const areas = boxes.map((r) => r.width * r.height);
  const aLo = Math.min(...areas), aHi = Math.max(...areas);
  let at = 0;
  const plan = kids.map((k, i) => {
    const m = aHi - aLo < 1 ? 0.5 : (areas[i] - aLo) / (aHi - aLo);   // 0 light … 1 heavy
    const step = { at, m, dur: Math.round(700 + m * 660), ease: EASES[m < 0.34 ? 0 : m < 0.7 ? 1 : 2] };
    at += Math.round(EXIT_STEP * (0.68 + m * 0.72));
    return step;
  });
  const EXIT_END = GATHER + Math.max(...plan.map((q) => q.at + q.dur));

  // The pull starts while the fields are still going, not after them. Waiting
  // for an empty screen is what made the two halves read as two events.
  const MOVE_AT = GATHER + 230;
  const TRAVEL = 5600;                   // the tunnel is built; now go through it
  const COAST = 3200;                    // and then you coast, you do not stop
  const DUR = MOVE_AT + TRAVEL;

  const t0 = performance.now();
  let prev = t0, travelled = 0, roll = 0, drew = false, queued = false;
  // A constant spin reads as a turntable. Modulating the rate — and letting it
  // cross zero — is what makes it read as banking through the turns.
  const twist = (ms: number) => Math.sin(ms * 0.00046) * 0.62 + Math.sin(ms * 0.00097) * 0.44;
  const smooth = (k: number) => k * k * (3 - 2 * k);

  const frame = (now: number) => {
    drew = true;
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    const ms = now - t0;
    const t = Math.min(1, ms / DUR);
    const g = smooth(Math.min(1, ms / GATHER));

    // One element leaves per beat, in the order they were read, each on its own
    // clock.
    if (!queued && ms > GATHER) {
      queued = true;
      kids.forEach((k, i) => setTimeout(() => {
        const q = plan[i], r = boxes[i];
        k.style.setProperty("--dx", `${Math.round(W / 2 - (r.left + r.width / 2))}px`);
        k.style.setProperty("--dy", `${Math.round(H / 2 - (r.top + r.height / 2))}px`);
        k.style.setProperty("--sd", `${q.dur}ms`);
        k.style.setProperty("--se", q.ease);
        // Heavy things do not shrink to nothing, they are still readable when
        // they reach the mouth; light things go to a speck and smear.
        k.style.setProperty("--ss", (0.02 + q.m * 0.07).toFixed(3));
        k.style.setProperty("--sb", `${(13 - q.m * 7).toFixed(1)}px`);
        k.classList.add("suck");
      }, plan[i].at));
      setTimeout(() => { host.classList.add("over"); shell.classList.add("gone"); }, EXIT_END - GATHER);
    }

    // Movement starts once the page has been emptied.
    const pull = Math.max(0, (ms - MOVE_AT) / TRAVEL);
    const p = Math.min(1, pull);
    // Leaves at a walk, ends at a sprint. Nothing about the first second should
    // look like the last.
    const top = 3 + Math.pow(p, 1.35) * 62;
    // Past the end it sheds speed on a cubic and settles to a drift it holds
    // for as long as the welcome is up. Cutting the loop here is what made the
    // ending land as a stall.
    const off = 1 - Math.pow(1 - Math.min(1, Math.max(0, (ms - DUR) / COAST)), 3);
    const speed = pull <= 0 ? 0 : top - (top - 4.5) * off;
    // Per second, not per frame. Accumulating raw `speed` made the ride a
    // different length on a 120Hz display than on a 60Hz one, and it is the
    // reason the tunnel crawls under any capture that throttles rAF.
    const k = dt * 60;
    travelled += speed * k;
    roll += (speed * 0.00052 + 0.0009 * g) * (1 + twist(ms)) * k;

    c.fillStyle = `rgba(4,7,14,${Math.max(0.07, 0.34 - g * 0.14 - p * 0.14 + off * 0.16).toFixed(3)})`;
    c.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;
    const f = Math.min(W, H) * (0.82 - Math.pow(p, 0.8) * 0.47 + speed * 0.0016);
    const hue = (opts.hue + t * 100) % 360;
    const [ax0, ay0] = axis(travelled);
    const ca = Math.cos(roll), sa = Math.sin(roll);

    const proj = (x: number, y: number, dz: number, z: number): [number, number] => {
      const [ax, ay] = axis(z);
      const px = x + ax - ax0, py = y + ay - ay0;
      return [cx + ((px * ca - py * sa) / dz) * f, cy + ((px * sa + py * ca) / dz) * f];
    };

    // Lights: soft blooms on the wall, the only large elements in here.
    for (const l of lights) {
      let dz = l.z - travelled;
      if (dz < 44) { l.z += DEPTH; dz = l.z - travelled; }
      // Recycling adds a whole DEPTH to z, so dz lands just past DEPTH and near
      // goes slightly negative — and Math.pow of a negative base is NaN, which
      // reaches addColorStop as `hsla(..., NaN)` and throws the loop away. The
      // motes clamp already; the lights did not, and that is what was killing
      // the flight partway through and landing it early.
      const near = Math.max(0, 1 - dz / DEPTH);
      const a = Math.pow(near, 2.6) * 0.42 * g;
      if (a < 0.012) continue;
      const [lx, ly] = proj(Math.cos(l.a) * l.r, Math.sin(l.a) * l.r, dz, l.z);
      const rad = l.s * (0.3 + near * 2.6);
      const grad = c.createRadialGradient(lx, ly, 0, lx, ly, rad);
      grad.addColorStop(0, `hsla(${(hue + 24) % 360}, 96%, 78%, ${a.toFixed(3)})`);
      grad.addColorStop(1, "transparent");
      c.fillStyle = grad;
      c.beginPath(); c.arc(lx, ly, rad, 0, Math.PI * 2); c.fill();
    }

    c.lineCap = "round";
    for (const m of motes) {
      const zPrev = m.z;
      let dz = m.z - travelled;
      if (dz < 34) { m.z += DEPTH; dz = m.z - travelled; }
      const dzPrev = Math.max(34, zPrev - (travelled - speed * k));
      const x = Math.cos(m.a) * m.r, y = Math.sin(m.a) * m.r;
      let p1 = proj(x, y, dz, m.z);
      let p0 = proj(x, y, dzPrev, zPrev);

      let mul = 1;
      if (m.from) {
        const sx = m.from.x * W, sy = m.from.y * H;
        p1 = [sx + (p1[0] - sx) * g, sy + (p1[1] - sy) * g];
        p0 = [sx + (p0[0] - sx) * g, sy + (p0[1] - sy) * g];
      } else {
        mul = Math.max(0, (g - 0.12) / 0.88);
      }
      if (mul <= 0.01) continue;

      const near = Math.max(0, 1 - dz / DEPTH);
      const a = (0.05 + Math.pow(near, 1.25) * 0.95) * mul;
      c.strokeStyle = m.tint
        ? `hsla(${(hue + 30) % 360}, 96%, ${64 + near * 28}%, ${a.toFixed(3)})`
        : `rgba(222,234,255,${a.toFixed(3)})`;
      c.lineWidth = m.w * (0.45 + near * 2.2);
      c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
    }

    // land() is idempotent; the loop carries on past it so the tunnel is still
    // travelling behind the welcome, just slower every second.
    if (t >= 1) land();
    if (!host.classList.contains("on")) return;   // torn down by Enter
    schedule(guarded);
  };

  const guarded = (now: number) => {
    // A throw mid-flight must still land the visitor; a frozen tunnel is worse
    // than an abrupt arrival.
    try {
      frame(now);
    } catch {
      land();
    }
  };
  schedule(guarded);
  setTimeout(() => { if (!drew) land(); }, 2500);
}
