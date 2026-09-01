/* The component ships as .jsx and this repo is allowJs:false, so it is never
 * typechecked. Declaring it here keeps the vendored file byte-identical to the
 * react-bits registry, the way console.css and art.ts are kept verbatim, so a
 * later re-pull overwrites it without losing hand edits. The specifier below
 * must match how it is imported, hence the alias form. */
declare module "@/app/console/acid-squares/AcidSquares" {
  export interface AcidSquaresProps {
    color1?: string; color2?: string; color3?: string;
    detail?: "low" | "medium" | "high";
    speed?: number; waveDepth?: number; zoom?: number; density?: number;
    glow?: number; exposure?: number; spread?: number; stepSize?: number;
    colorShift?: number; contrast?: number; brightness?: number;
    blur?: number; opacity?: number;
    grain?: boolean; grainIntensity?: number;
    mouseInteraction?: boolean; mouseRadius?: number; mouseStrength?: number;
  }
  const AcidSquares: (props: AcidSquaresProps) => React.JSX.Element;
  export default AcidSquares;
}
