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

type Kind =
  | "cursor" | "spark" | "check"
  | "dollar" | "fire" | "glass" | "agents" | "machine";

const GLYPH: Record<Kind, string> = {
  cursor: "M13 7 L13 41 L21 33 L26.6 44 L32.4 41.2 L26.8 30.4 L38 29.6 Z",
  spark:
    "M24 4 C25.6 15.6 32.4 22.4 44 24 C32.4 25.6 25.6 32.4 24 44 C22.4 32.4 15.6 25.6 4 24 C15.6 22.4 22.4 15.6 24 4 Z",
  // Precomputed scallop: generating it per render risks float drift between
  // server and client, which is what broke the gauge earlier.
  check:
    "M24.00,5.00 A 10 10 0 0 1 30.50,6.15 A 10 10 0 0 1 40.45,14.50 A 10 10 0 0 1 42.71,27.30 A 10 10 0 0 1 36.21,38.55 A 10 10 0 0 1 24.00,43.00 A 10 10 0 0 1 11.79,38.55 A 10 10 0 0 1 5.29,27.30 A 10 10 0 0 1 7.55,14.50 A 10 10 0 0 1 17.50,6.15 Z",
  /* ── traced from the Higgsfield renders ────────────────────────────────
   * The five below were generated as stickers, then vectorised rather than
   * shipped as PNGs: the three above are inline SVG and a raster sitting in the
   * same tile header does not match their edge. Each is the coloured fill only,
   * because the recipe redraws the white keyline as a stroke. Several are more
   * than one piece — the laptop's base, the $ counters, the magnifier's lens —
   * which is why the fill rule is per glyph and why the white pass fills as
   * well as strokes. */
  dollar:
    "M22 5.9C21.3 6 21.1 6.4 21.1 7.9C21.1 9.3 21 9.4 20.4 9.5C15.7 10.5 12.6 13.5 12.5 17.3C12.3 21.5 14.8 24 20.5 25.6L21.8 25.9L21.8 28.4C21.8 29.8 21.8 30.9 21.7 30.9C21.1 30.9 20.2 30.1 19.4 29C17.4 25.7 12.7 26.1 12.6 29.5C12.4 32.9 15.4 36.2 19.8 37.6C21.1 38 21.1 38 21.1 39.9C21.1 42.2 21.2 42.2 23.6 42.2C26 42.2 26.2 42.1 26.2 39.7C26.2 38.1 26.2 38.2 27.3 37.9C32.6 36.8 35.7 32.8 35.5 27.7C35.3 23.5 32.5 21 26.7 19.8L25.4 19.5L25.4 17.5C25.4 16.4 25.4 15.4 25.4 15.4C26.1 15.4 27.3 16.3 27.8 17.2C29.4 19.9 34.4 19.9 34.7 17.2C35 13.9 31.7 10.6 27 9.5C26.2 9.4 26.2 9.3 26.2 8.1C26.2 6.8 26 6.3 25.6 6C25.2 5.8 22.7 5.8 22 5.9ZM21.8 17.2C21.8 19 21.8 19 21.5 19C19.5 18.6 19 16.6 20.8 15.7C21.8 15.2 21.8 15.2 21.8 17.2ZM26.3 26.7C28.6 27.4 28.8 30.2 26.7 31C25.4 31.5 25.4 31.5 25.4 28.9C25.4 26.3 25.3 26.4 26.3 26.7Z",
  fire:
    "M23.9 6.3C22.3 6.8 20.6 8.5 19.9 10.3C19.1 12.2 19.1 13.9 19.8 16.4C20.5 19.1 20.2 20.3 18.8 20.3C17.8 20.3 17.2 19.1 17.3 17.6C17.6 14.4 13.8 19.2 12.7 23.4C10.4 32.9 19.2 42.2 27.6 39.1C34.2 36.6 37.6 29.1 35.2 22.3C34.1 19.5 32.9 17.7 29.6 14.4C26.5 11.2 26.3 10.9 26.1 8.3C25.9 6.2 25.4 5.7 23.9 6.3Z",
  glass:
    "M19.7 7.5C10.7 8.9 5.8 19 9.9 27.4C12.9 33.6 20.3 36.7 26.4 34.4C27.4 34 28.4 33.5 28.6 33.3C29 32.8 29.1 32.9 32.9 36.8C37.1 40.9 37 40.9 38.5 40.9C40.7 40.9 42.2 38.8 41.7 36.6C41.5 35.6 41.3 35.4 34.6 29.1C33.7 28.2 33.7 28.2 34.2 27.2C37.4 20.2 34.5 12.1 27.6 8.6C25.6 7.5 22.3 7.1 19.7 7.5ZM23.9 8.2C25.1 8.4 27.5 9.1 27.5 9.4C27.5 9.4 27.2 9.4 25.8 9.4C25.4 9.4 24.9 9.4 24.6 9.4C24.4 9.4 24.1 9.4 24 9.4C23 9.4 22.3 9.4 22 9.5C21.8 9.5 21.7 9.5 21.7 9.4C21.6 9.3 21.6 9.3 21.5 9.4C21.5 9.5 21.3 9.5 21.1 9.4C20.9 9.4 20 9.4 19.1 9.4C18.3 9.4 17.4 9.4 17.2 9.3C17 9.2 16.9 9.3 16.6 9.4C16.4 9.5 16.3 9.5 16.2 9.5C16 9.3 18.5 8.4 19.7 8.2C20.1 8.2 20.5 8.1 20.6 8.1C21 8 23.1 8 23.9 8.2ZM23.2 14.6C27.9 15.5 29.9 21.5 26.9 25.3C24.3 28.6 19 28.6 16.5 25.2C12.8 20.1 17.1 13.3 23.2 14.6Z",
  agents:
    "M23.1 8.1C18.7 9 16.9 14.9 20.1 18.3C20.7 19 20.7 18.8 19.4 21.2C18.8 22.3 17.9 23.9 17.4 24.8C16.4 26.5 16.5 26.5 15.5 26.1C10 24.2 5.8 31.4 9.3 36.6C12.1 40.8 17.1 40.3 19.2 35.6C19.7 34.3 19.1 34.5 24.2 34.5C29.4 34.5 28.8 34.3 29.6 35.8C32.1 40.9 37.6 40.7 40 35.4C42.2 30.3 38 24.4 33.1 26.1C32.2 26.4 32.3 26.4 31.6 25.2C30.1 22.5 29.2 21 28.7 20C28 18.8 28 18.8 28.5 18.4C28.7 18.2 29 17.7 29.2 17.4C31.9 12.8 28.2 7.1 23.1 8.1ZM25.7 20.4C25.8 20.5 26.5 21.7 27.3 23.3C27.6 23.8 28 24.5 28.1 24.8C29.4 26.9 30 27.9 30 28.2C30 28.6 29.1 30.8 28.8 31.1C28.6 31.4 20 31.4 19.8 31.1C19.6 30.9 18.7 28.8 18.6 28.4C18.6 28.1 18.6 28 20.6 24.5C21.3 23.4 22 22 22.3 21.5C22.6 21 22.9 20.5 23 20.4C23.2 20.3 25.6 20.3 25.7 20.4Z",
  machine:
    "M10.6 10.9C10.2 11.1 9.8 11.4 9.6 11.8C9.3 12.3 9.2 30.9 9.5 31.1C9.7 31.4 38.4 31.4 38.6 31.2C38.7 31.1 38.7 28.5 38.7 21.5C38.6 10.8 38.7 11.5 37.7 11C37.2 10.7 11.4 10.6 10.6 10.9ZM6.6 31.5C5.8 32.2 6 35.7 6.9 36.6C7.7 37.4 6.3 37.3 24 37.3C41.8 37.3 40.3 37.4 41.1 36.6C42 35.7 42.2 32.4 41.5 31.6C41.1 31.2 39.3 31.2 38.8 31.5C38.2 31.9 9.8 31.9 9.3 31.5C8.8 31.2 7 31.2 6.6 31.5Z",
};

/** The lit skin of each traced glyph. A single top-down wash reads flat on a
 *  round form; the reference puts a dome on every ball, so the highlight is
 *  traced too and only the three hand-drawn glyphs fall back to the wash. */
const GLOSS: Partial<Record<Kind, string>> = {
  dollar:
    "M21 10.3C18.9 10.6 17.2 11.4 15.9 12.5C15.6 12.9 15.7 13.1 16.2 12.9C16.5 12.9 16.7 12.9 17.7 12.9C17.9 12.9 18 13 18.1 13.1C18.1 13.3 18.2 13.3 18.3 13.3C18.5 13.2 18.5 13.2 18.5 13.1C18.4 13 18.5 13 18.5 13.1C18.6 13.1 19.1 13 19.7 12.9C21.9 12.4 26.2 12.6 28.7 13.2C29 13.3 29 13.3 28.8 13.1C28.6 12.9 28.6 12.9 28.8 13C28.9 13 29.1 13 29.1 12.9C29.2 12.8 29.7 13 29.8 13.2C29.9 13.2 29.9 13.2 29.9 13.1C29.9 12.9 30 12.9 30.5 13C30.9 13 31.2 12.9 31.3 12.9C31.3 12.8 31.5 12.9 31.7 13.1C31.9 13.2 32 13.3 32 13.3C32 12.8 29.7 11.3 28.2 10.8C26.5 10.3 23.2 10 21 10.3Z",
  fire:
    "M24 6.8C22 7.3 19.7 10.8 20 13.1C20.1 13.7 20.1 13.7 20.3 12.8C20.4 12.4 20.6 11.9 20.6 11.8C20.7 11.5 21.3 10.9 21.3 11C21.3 11 21.5 11 21.7 10.8C23 10.1 24.1 9.7 24.9 9.7C25 9.7 25.2 9.7 25.2 9.6C25.2 9.5 25.3 9.4 25.3 9.3C25.6 9.1 25.2 6.9 24.8 6.8C24.5 6.7 24.6 6.7 24 6.8Z",
  glass:
    "M19.7 7.5C10.7 8.9 5.8 19 9.9 27.4C10.5 28.6 11.2 29.7 11.3 29.6C11.3 29.6 11.2 29.4 11 29.1C10.4 28.3 10.4 27.8 10.9 28.1C11.1 28.2 11.2 28.2 11.2 28.1C11.2 28.1 11.3 28.1 11.3 28.2C11.4 28.3 11.4 28.3 11.4 28.2C11.4 28.1 11.5 28.1 11.6 28.1C11.7 28.1 11.8 28.1 11.8 28.2C11.8 28.2 11.9 28.3 11.9 28.2C12 28.2 12 28.2 12.1 28.3C12.1 28.5 12.5 28.5 12.5 28.3C12.5 28.2 12.5 28.1 12.5 28.1C12.6 28.1 12.7 28 12.7 28C12.9 28 12.9 28 12.9 28.2C12.9 28.4 12.9 28.4 13 28.2C13.1 28.1 13.2 28.1 13.3 28.2C13.4 28.3 13.5 28.3 13.5 28.1C13.5 28 13.5 28 13.7 28.1C13.8 28.2 13.8 28.2 13.9 28.1C13.9 27.9 14.1 27.9 14.1 28.1C14.1 28.2 14.2 28.3 14.2 28.3C14.3 28.3 14.3 28.2 14.3 28.2C14.3 28 14.8 28.1 14.8 28.2C14.8 28.4 14.8 28.4 15 28.2C15.2 27.9 15.2 27.9 15.4 28.1C15.4 28.2 15.5 28.2 15.6 28.2C15.7 28.2 15.9 28.2 16 28.3C16.1 28.4 16.1 28.4 16.1 28.2C16 28.1 16.1 28 16.1 28C16.2 28.1 16.2 28.1 16.2 28.2C16.2 28.3 16.3 28.4 16.4 28.4C16.5 28.4 16.6 28.3 16.6 28.3C16.6 28.2 16.8 28.2 17 28.3C17.2 28.3 17.3 28.4 17.3 28.4C17.3 28.4 17.5 28.3 17.6 28.3C18 28.1 18.3 28 18.3 28.2C18.4 28.4 19 28.4 19.1 28.2C19.1 28.1 19.2 28.1 19.2 28.3C19.3 28.6 19.5 28.5 19.6 28C19.6 27.7 19.6 27.7 19.3 27.6C19.2 27.6 19.1 27.5 19.1 27.5C19.1 27.5 19.5 27.6 19.9 27.7C21.4 28.1 22.7 28 24.1 27.5C24.3 27.4 24.5 27.4 24.5 27.4C24.6 27.4 24.2 27.6 23.7 27.8C23.2 27.9 23 28.1 23.1 28C23.3 28 23.5 28.1 23.6 28.1C23.7 28.3 23.9 28.3 23.9 28.1C23.9 28 24 28 24.1 28C24.2 28 24.3 28 24.2 28C24.1 28.1 24 28.4 24.2 28.4C24.2 28.4 24.3 28.3 24.3 28.3C24.3 28.2 24.8 28.2 24.9 28.3C25 28.4 25.4 28.5 25.5 28.5C25.6 28.4 25.6 28.4 25.5 28.4C25.4 28.3 25.5 28.2 25.6 28.1C25.8 28 25.8 28 25.8 28.2C25.8 28.3 25.8 28.4 25.9 28.4C25.9 28.4 25.9 28.3 25.9 28.2C25.8 28 26.1 28 26.3 28.3C26.4 28.5 26.9 28.4 26.9 28.2C26.9 28.1 26.9 28.1 27 28.1C27 28.1 27.1 28.1 27 28.2C26.9 28.4 27.8 28.3 28.1 28.1C28.4 27.8 28.4 27.8 28.5 28C28.6 28.2 28.6 28.2 28.7 28.1C28.7 28 28.8 28 29 28.1C29.3 28.2 29.3 28.2 29.3 28.3C29.1 28.5 29.1 28.5 29.5 28.5C29.6 28.6 29.8 28.5 29.8 28.5C29.8 28.4 29.9 28.4 30 28.4C30.2 28.4 30.3 28.3 30.4 28.2C30.4 28.2 30.5 28.2 30.5 28.3C30.6 28.4 30.6 28.4 30.8 28.4C31.1 28.3 31.6 28.4 31.7 28.7C31.8 28.9 32.3 28.9 32.3 28.7C32.3 28.7 32.3 28.7 32.3 28.7C32.4 28.7 32.4 28.7 32.4 28.8C32.4 28.9 32.5 29 32.6 28.9C32.7 28.9 32.9 28.8 33.1 28.8C33.3 28.8 33.3 28.7 33.3 28.6C33.3 28.5 33.3 28.5 33.3 28.5C33.4 28.5 33.5 28.4 33.5 28.3C33.6 27.9 33.9 27.2 33.9 27.2C33.9 27.2 33.9 27.4 33.8 27.6C33.7 27.8 33.6 28 33.6 28.1C33.6 28.3 34.5 29.3 34.7 29.3C34.7 29.3 34.6 29 34.3 28.8C33.8 28.2 33.7 28.1 34.2 27.2C38.8 17.1 30.5 5.8 19.7 7.5ZM23.2 14.6C27.9 15.5 29.9 21.5 26.9 25.3C24.3 28.6 19 28.6 16.5 25.2C12.8 20.1 17.1 13.3 23.2 14.6Z",
  agents:
    "M23.2 8.4C21.2 8.8 19 11.2 19 12.9C19 13.1 20.9 13.6 22.3 13.8C24.7 14.1 29.6 13.5 29.6 12.8C29.6 10.3 26 7.9 23.2 8.4ZM13 26.3C10.9 26.5 7.4 30.3 8.8 30.7C10.3 31.1 11 31.2 12.3 31.1C13 31.1 14.3 31.1 15.1 31.1C16.4 31.2 18.3 30.9 18.6 30.6C18.7 30.4 17.9 28.6 17.3 27.9C16.4 26.8 14.7 26 13.7 26.2C13.6 26.2 13.4 26.2 13 26.3ZM34 26.3C32.2 26.5 30.7 28.1 30 30.1C29.9 30.7 29.9 30.6 31.1 30.9C32 31.2 32.2 31.2 33.5 31.1C34.3 31.1 35.6 31.1 36.3 31.1C38.7 31.2 40.1 30.8 39.8 30C39 27.5 36.4 25.9 34 26.3Z",
  machine:
    "M10.6 10.9C10.2 11.1 9.8 11.4 9.6 11.8C9.3 12.4 9.2 31.2 9.5 31.2C9.6 31.2 9.6 31.1 9.5 31C9.5 30.8 9.5 28.2 9.5 25.1C9.6 22 9.6 19.9 9.6 20.3C9.6 20.8 9.7 21.2 9.7 21.1C9.8 21.1 9.9 21.2 9.9 21.2C9.9 21.3 10 21.4 10.1 21.3C10.2 21.3 10.3 21.3 10.3 21.4C10.4 21.5 11 21.5 11 21.4C11 21.3 11 21.3 11.1 21.4C11.1 21.5 11.3 21.5 11.7 21.4C12 21.3 12.3 21.3 12.3 21.3C12.4 21.4 12.4 21.3 12.5 21.2C12.5 21.1 13.6 21.1 13.6 21.3C13.7 21.4 13.9 21.4 14.1 21.2C14.2 21.1 14.4 21.1 14.6 21.1C14.7 21.2 15 21.2 15.1 21.2C15.3 21.2 15.4 21.2 15.4 21.3C15.4 21.4 15.5 21.4 15.5 21.3C15.6 21.2 15.7 21.2 15.7 21.2C15.8 21.4 16.5 21.4 16.5 21.3C16.5 21.1 16.7 21.2 16.8 21.3C16.8 21.4 16.9 21.4 17.1 21.3C17.2 21.2 17.4 21.2 17.5 21.2C17.6 21.2 17.7 21.2 17.7 21.3C17.7 21.4 17.7 21.4 17.8 21.3C17.9 21.2 17.9 21.2 17.9 21.3C18 21.4 18 21.4 18.1 21.3C18.2 21.2 18.4 21.2 19.1 21.2C19.5 21.2 20.4 21.2 21.1 21.2C21.8 21.2 22.2 21.2 22.2 21.2C22.2 21.3 22.3 21.2 22.4 21.1C22.5 20.9 22.5 20.9 22.6 21.2C22.7 21.3 22.7 21.4 22.8 21.3C23 21.2 23.5 21.2 23.5 21.3C23.5 21.4 24.1 21.5 24.2 21.4C24.2 21.3 24.3 21.3 24.4 21.3C24.5 21.4 24.5 21.3 24.5 21.3C24.5 21.1 25.2 21.2 25.3 21.3C25.3 21.4 25.4 21.4 25.6 21.3C25.8 21.2 26 21.2 26.1 21.2C26.2 21.3 26.4 21.2 26.5 21.2C27 21 27.7 21 27.9 21.2C28 21.4 28.1 21.4 28.3 21.3C28.5 21.3 28.8 21.3 29.1 21.3C29.3 21.2 29.6 21.2 29.7 21.2C29.7 21.1 29.8 21.1 29.9 21.1C30.1 21.2 31.2 21.3 31.2 21.2C31.2 21 32.2 21.1 32.5 21.2C32.7 21.3 32.9 21.4 33 21.4C33.1 21.4 33.2 21.4 33.3 21.4C33.4 21.5 33.5 21.5 33.5 21.4C33.6 21.3 33.7 21.3 33.8 21.4C33.9 21.4 33.9 21.4 33.9 21.3C33.9 21.2 34 21.2 34.1 21.2C34.2 21.3 34.4 21.3 34.5 21.2C34.7 21.1 35.3 21.1 35.4 21.3C35.5 21.3 35.6 21.4 35.7 21.3C35.7 21.3 35.8 21.3 35.8 21.4C35.8 21.5 35.8 21.5 35.9 21.5C35.9 21.4 36.2 21.4 36.4 21.4C36.6 21.4 36.9 21.3 36.9 21.3C36.9 21.2 37.5 21.2 37.6 21.3C37.7 21.4 37.8 21.3 37.8 21.3C37.8 21.2 37.9 21.2 38.1 21.2C38.4 21.1 38.4 21.1 38.4 20.7C38.4 20.4 38.4 20.3 38.4 20.3C38.5 20.3 38.5 22.8 38.6 25.8C38.6 30.4 38.7 29.7 38.6 21.6C38.6 10.8 38.7 11.5 37.7 11C37.2 10.7 11.4 10.6 10.6 10.9Z",
};

/** Light stop, deep stop, keyline width, fill rule. */
const SKIN: Record<Kind, [string, string, number, "nonzero" | "evenodd"]> = {
  cursor: ["#ff9a5c", "#f0561f", 9, "nonzero"],
  spark: ["#ffd766", "#f5ae1b", 9, "nonzero"],
  check: ["#8fe06a", "#3fbf4e", 9, "nonzero"],
  dollar: ["#8fe06a", "#12a038", 9, "evenodd"],
  fire: ["#ffb03a", "#f03613", 9, "nonzero"],
  glass: ["#cba6ff", "#7b34f2", 9, "evenodd"],
  agents: ["#8df3ff", "#00b0d0", 8, "evenodd"],
  machine: ["#b2c0ff", "#2044e8", 9, "nonzero"],
};

export function Sticker({ kind }: { kind: Kind }) {
  const [c1, c2, sw, rule] = SKIN[kind];
  const id = `st-${kind}`;
  const lit = GLOSS[kind];
  return (
    <svg className="ic" viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={lit ? ".62" : ".45"} />
          <stop offset={lit ? "1" : ".55"} stopColor="#fff" stopOpacity={lit ? ".04" : "0"} />
        </linearGradient>
      </defs>
      {/* White fills as well as strokes. A multi-piece glyph strokes its own
          buried seams too, and the fill is what hides them; the colour pass
          then covers the inner half of the keyline and leaves the outer half. */}
      <path
        d={GLYPH[kind]} fillRule={rule} fill="#fff"
        stroke="#fff" strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"
      />
      <path d={GLYPH[kind]} fillRule={rule} fill={`url(#${id})`} />
      {kind === "check" && (
        <path d="M17.5 24.4 L22.2 29.2 L31 19.6" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      <path d={lit ?? GLYPH[kind]} fillRule={lit ? "evenodd" : rule} fill={`url(#${id}-g)`} />
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
