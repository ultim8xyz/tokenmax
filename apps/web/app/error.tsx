"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * A blank page with "a client-side exception has occurred" tells nobody
 * anything. This shows what actually threw, and offers the retry.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("tokenmax:", error);
  }, [error]);

  return (
    <div id="shell">
      <header className="rail">
        <Link href="/" className="brand" aria-label="Leaderboard">
          TOKEN<em>MAX</em>
        </Link>
      </header>
      <main id="stage">
        <section className="view on" id="onboard">
          <div className="ob">
            <div className="steps rise" style={{ "--i": 0 } as React.CSSProperties}>
              <span>Something threw</span>
              <i className="on" />
              <i />
            </div>
            <h2 className="rise" style={{ "--i": 1 } as React.CSSProperties}>
              That page did not load
            </h2>
            <p className="rise" style={{ "--i": 2 } as React.CSSProperties}>
              {error.message || "No message came with it."}
            </p>
            {error.digest && (
              <div className="cmd rise" style={{ "--i": 3 } as React.CSSProperties}>
                <code>digest {error.digest}</code>
              </div>
            )}
            <button className="go rise" style={{ "--i": 4 } as React.CSSProperties} onClick={reset}>
              Try again
            </button>
            <Link
              className="skip rise"
              style={{ "--i": 5, textAlign: "center" } as React.CSSProperties}
              href="/"
            >
              Back to the leaderboard
            </Link>
          </div>
        </section>
      </main>
      <div className="hints" />
    </div>
  );
}
