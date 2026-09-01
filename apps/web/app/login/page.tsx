"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GhMark } from "../console/gh-mark";
import { PlainShell } from "../console/shell";
import { HueDrift } from "../console/hue";

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
      <div className="ob">
        {/* The token is the whole hero. Two faces on one preserve-3d parent, so
            the spin is a real rotation of the real asset rather than a flat
            image being sheared. It is decorative, so it is hidden from
            assistive tech and the page still reads as a single sign-in. */}
        <div className="tok rise" style={{ "--i": 0 } as React.CSSProperties} aria-hidden="true">
          <span className="tokglow" />
          <div className="tokspin">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/coin.png" srcSet="/coin.png 1x, /coin@2x.png 2x" alt="" />
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
          <div className="wait">
            <span className="d" />
            <span>That account could not be admitted. Try signing in again.</span>
          </div>
        )}
        {failure && (
          <div className="wait">
            <span className="d" />
            <span>
              Sign-in failed — <b>{failure}</b>
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
      <HueDrift hue={210} />
      <Suspense>
        <LoginInner />
      </Suspense>
    </PlainShell>
  );
}
