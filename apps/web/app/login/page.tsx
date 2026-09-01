"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GhMark } from "../console/gh-mark";
import { Icon } from "../console/bevel";
import { PlainShell } from "../console/shell";
import AcidSquares from "@/app/console/acid-squares/AcidSquares";
import { GridScan } from "@/app/console/grid-scan/GridScan";

/* Slices that make up the coin's edge. Enough to read as solid at the
   thickness below; more only costs paint. */
const SLICES = 14;

function LoginInner() {
  const [busy, setBusy] = useState(false);
  const params = useSearchParams();
  const denied = params.get("denied") === "1";
  const failure = params.get("error");

  async function signIn() {
    setBusy(true);
    const next = params.get("next") ?? "/";
    await createClient().auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(next)}` },
    });
  }

  return (
    <section className="view on gate" id="onboard">
      {/* GridScan is the ground. ?bg=acid still reaches the orange shader for
          comparison, the way ?font=2 swaps the type pairing on the board. */}
      <div className="acid" aria-hidden="true">
        {params.get("bg") === "acid" ? (

        <AcidSquares
          color1="#000000"
          color2="#ff6800"
          color3="#ffffff"
          detail="high"
          speed={0.75}
          waveDepth={2.2}
          zoom={0.8}
          density={4.5}
          glow={2.05}
          exposure={2700}
          spread={0.3}
          stepSize={0.003}
          colorShift={1.65}
          contrast={1}
          brightness={0.7}
          blur={0.25}
          opacity={1}
          grain={false}
          grainIntensity={0}
          mouseInteraction={false}
          mouseRadius={0.17}
          mouseStrength={0.1}
        />
        ) : (

          <GridScan
            sensitivity={0}
            lineThickness={2}
            linesColor="#6736c1"
            scanColor="#7C3AED"
            scanOpacity={0.5}
            gridScale={0.07}
            lineStyle="solid"
            lineJitter={0}
            scanDirection="backward"
            noiseIntensity={0.02}
            scanGlow={1}
            scanSoftness={1.5}
            scanDuration={2.5}
            scanDelay={1.5}
            scanOnClick={false}
          />
        )}
      </div>

      <div className="ob">
        {/* The token is the whole hero. Two faces on one preserve-3d parent, so
            the spin is a real rotation of the real asset rather than a flat
            image being sheared. It is decorative, so it is hidden from
            assistive tech and the page still reads as a single sign-in. */}
        <div className="tok rise" style={{ "--i": 0 } as React.CSSProperties} aria-hidden="true">
          <span className="tokglow" />
          <div className="tokspin">
            {/* The coin is given real thickness by stacking the same art along
                Z between the two faces. Edge-on it is a solid band rather than
                a vanishing line, which is the whole difference between a
                turning image and a turning object. */}
            {Array.from({ length: SLICES }, (_, i) => (
              <i key={i} className="sl" style={{ "--l": i } as React.CSSProperties} />
            ))}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="f" src="/coin.png" srcSet="/coin.png 1x, /coin@2x.png 2x" alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="b" src="/coin.png" srcSet="/coin.png 1x, /coin@2x.png 2x" alt="" />
          </div>
        </div>

        <h2 className="rise" style={{ "--i": 1 } as React.CSSProperties}>Join the board</h2>
        <p className="rise" style={{ "--i": 2 } as React.CSSProperties}>
          GitHub, default scopes. Nothing is read from your repositories. The sign-in only
          says who you are.
        </p>

        <button
          className="gh rise"
          style={{ "--i": 3 } as React.CSSProperties}
          onClick={signIn}
          disabled={busy}
        >
          <GhMark />
          <span>{busy ? "Opening GitHub…" : "Continue with GitHub"}</span>
        </button>

        {denied && (
          <div className="wait" role="alert">
            <Icon name="x" />
            <span>That account could not be admitted. Try signing in again.</span>
          </div>
        )}
        {failure && (
          <div className="wait" role="alert">
            <Icon name="x" />
            <span>
              Sign-in failed. The reason given was <b>{failure}</b>. Try signing in again.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <PlainShell>
      <Suspense>
        <LoginInner />
      </Suspense>
    </PlainShell>
  );
}
