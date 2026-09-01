/**
 * Bevel widget primitives.
 *
 * Reference lock: Bevel's watch/phone widgets — a dark rounded tile per metric,
 * a small sticker glyph beside the title, one big figure, thick ring gauges with
 * rounded caps. The sticker recipe is the orange-cursor icon Misha sent: draw the
 * glyph twice, once as a fat white keyline with round joins and once filled, then
 * lay a top gloss over it.
 *
 * Deliberately server-safe (no "use client"): every export here is pure markup,
 * so the member page stays a server component. Gradient ids are derived from the
 * glyph name rather than randomised, or two tiles using the same sticker would
 * fight over the id and the server and client markup would not match.
 */

type Kind = "cursor" | "spark" | "check" | "rocket";

const GLYPH: Record<Kind, string> = {
  cursor: "M13 7 L13 41 L21 33 L26.6 44 L32.4 41.2 L26.8 30.4 L38 29.6 Z",
  spark:
    "M24 4 C25.6 15.6 32.4 22.4 44 24 C32.4 25.6 25.6 32.4 24 44 C22.4 32.4 15.6 25.6 4 24 C15.6 22.4 22.4 15.6 24 4 Z",
  // Precomputed scallop: generating it per render risks float drift between
  // server and client, which is what broke the gauge earlier.
  check:
    "M24.00,5.00 A 10 10 0 0 1 30.50,6.15 A 10 10 0 0 1 40.45,14.50 A 10 10 0 0 1 42.71,27.30 A 10 10 0 0 1 36.21,38.55 A 10 10 0 0 1 24.00,43.00 A 10 10 0 0 1 11.79,38.55 A 10 10 0 0 1 5.29,27.30 A 10 10 0 0 1 7.55,14.50 A 10 10 0 0 1 17.50,6.15 Z",
  // Upright, with the fins and flame as separate subpaths. A diagonal rocket's
  // concavity fills in under a 9px keyline and reads as a leaf.
  rocket:
    "M24 5 C30 11 33.5 18.5 33.5 26.5 L33.5 31.5 L14.5 31.5 L14.5 26.5 C14.5 18.5 18 11 24 5 Z M14.5 25 L8.5 34 L14.5 31.5 Z M33.5 25 L39.5 34 L33.5 31.5 Z M19.5 32 L24 43 L28.5 32 Z",
};

const SKIN: Record<Kind, [string, string, number]> = {
  cursor: ["#ff9a5c", "#f0561f", 9],
  spark: ["#ffd766", "#f5ae1b", 9],
  check: ["#8fe06a", "#3fbf4e", 9],
  rocket: ["#9db2ff", "#4a6ef0", 7],
};

export function Sticker({ kind }: { kind: Kind }) {
  const [c1, c2, sw] = SKIN[kind];
  const id = `st-${kind}`;
  return (
    <svg className="ic" viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".45" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={GLYPH[kind]} fill="none" stroke="#fff" strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
      <path d={GLYPH[kind]} fill={`url(#${id})`} />
      {kind === "check" && (
        <path d="M17.5 24.4 L22.2 29.2 L31 19.6" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      <path d={GLYPH[kind]} fill={`url(#${id}-g)`} />
    </svg>
  );
}

export function Tile({
  icon, title, span, children,
}: { icon: Kind; title: string; span?: 2 | 4; children: React.ReactNode }) {
  return (
    <div className={span ? `bt w${span}` : "bt"}>
      <div className="bth">
        <Sticker kind={icon} />
        {title}
      </div>
      {children}
    </div>
  );
}

/** The big figure, with its unit set small and dim beside it. */
export function Fig({ v, u }: { v: string; u?: string }) {
  return (
    <div className="bfig">
      {v}
      {u && <small>{u}</small>}
    </div>
  );
}

export function Sub({ children }: { children: React.ReactNode }) {
  return <div className="bsub">{children}</div>;
}

export function Chips({ children }: { children: React.ReactNode }) {
  return <div className="bchips">{children}</div>;
}

export function Chip({ tone = "n", children }: { tone?: "up" | "dn" | "n"; children: React.ReactNode }) {
  return <span className={`bchip ${tone}`}>{children}</span>;
}

/** Round to 2dp everywhere geometry is computed: raw floats differed in the last
 *  digit between server and client and tripped a hydration mismatch. */
const r2 = (n: number) => Math.round(n * 100) / 100;

export function Ring({
  pct, colour, value, label, note,
}: { pct: number; colour: string; value: string; label: string; note?: string }) {
  const R = 34;
  const C = r2(2 * Math.PI * R);
  const off = r2(C * (1 - Math.min(100, Math.max(0, pct)) / 100));
  return (
    <div className="bring">
      <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">
        <circle cx="46" cy="46" r={R} fill="none" stroke="var(--bv-track)" strokeWidth="9" />
        <circle
          cx="46" cy="46" r={R} fill="none" stroke={colour} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 46 46)"
        />
        <text className="brv" x="46" y="52" textAnchor="middle">{value}</text>
      </svg>
      <div className="blab">
        {label}
        {note && <i>{note}</i>}
      </div>
    </div>
  );
}

/** The Energy Bank bar: one cell per day, lit on the days you spent. */
export function SegBar({ costs }: { costs: number[] }) {
  const max = Math.max(1, ...costs);
  return (
    <div className="bseg" aria-hidden="true">
      {costs.map((c, i) => (
        <i key={i} className={c === 0 ? "" : c > max * 0.3 ? "hot" : "warm"} />
      ))}
    </div>
  );
}

/** Where this member sits between the board's cheapest and priciest output. */
export function ScaleBar({ pct, left, right }: { pct: number; left: string; right: string }) {
  const at = r2(Math.min(98, Math.max(2, pct)));
  return (
    <>
      <div className="bscale">
        <u style={{ left: `calc(${at}% - 1.5px)` }} />
      </div>
      <div className="bscmk">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </>
  );
}

/* ── real icons ───────────────────────────────────────────────────────────
 * Lucide paths, inlined. Three glyphs does not justify a dependency, and
 * Lucide's grid (24, stroke 2, round caps) is what keeps them consistent.
 * They take currentColor so state is a CSS change, never a second asset. */

const PATHS = {
  back: "M19 12H5M12 19l-7-7 7-7",
  trophy:
    "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z",
  external: "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  x: "M18 6 6 18M6 6l12 12",
} as const;

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg
      className="lic"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name].split("M").filter(Boolean).map((d, i) => (
        <path key={i} d={`M${d}`} />
      ))}
    </svg>
  );
}

/** The wordmark: the real coin Misha supplied, plus the name.
 *  The source is a 5MB SVG carrying two embedded 3088px rasters (a luminance
 *  mask and the colour plate); those were composited to RGBA and resized here,
 *  because shipping the SVG would ship both rasters on every page. */
export function Mark() {
  return (
    <span className="bmark">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/coin.png"
        srcSet="/coin.png 1x, /coin@2x.png 2x"
        alt=""
        aria-hidden="true"
        width={26}
        height={26}
      />
      <b>tokenmax</b>
    </span>
  );
}
