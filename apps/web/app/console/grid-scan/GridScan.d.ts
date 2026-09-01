/* Vendored verbatim from the react-bits registry, same as AcidSquares.
 * NOTE: this component imports face-api.js and, on mount, fetches face
 * detection model weights from cdn.jsdelivr.net regardless of whether the
 * webcam is used. enableWebcam defaults to false and is not passed here, so
 * nothing asks for a camera, but the weights download is unconditional. Strip
 * that effect before this ships on the sign-in page. */
declare module "@/app/console/grid-scan/GridScan" {
  export interface GridScanProps {
    sensitivity?: number; lineThickness?: number;
    linesColor?: string; scanColor?: string; scanOpacity?: number;
    gridScale?: number; lineStyle?: "solid" | "dashed" | "dotted";
    lineJitter?: number; scanDirection?: "forward" | "backward";
    noiseIntensity?: number; scanGlow?: number; scanSoftness?: number;
    scanDuration?: number; scanDelay?: number; scanOnClick?: boolean;
    enableWebcam?: boolean; modelsPath?: string;
  }
  /* Named export, unlike AcidSquares which is a default. Importing it as a
     default resolves to undefined and React throws "Element type is invalid". */
  export const GridScan: (props: GridScanProps) => React.JSX.Element;
}
