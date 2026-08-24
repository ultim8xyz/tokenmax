"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * There is nowhere else to be, so a wrong URL goes to the board.
 *
 * Client-side rather than a server `redirect()`: Next renders this boundary for
 * an unmatched route and keeps the 404 status, which is the honest status — so
 * the move happens in the browser, with a link for anyone who lands before the
 * effect runs.
 */
export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

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
              <span>No such page</span>
              <i className="on" />
              <i />
            </div>
            <h2 className="rise" style={{ "--i": 1 } as React.CSSProperties}>
              Taking you back
            </h2>
            <Link className="go rise" style={{ "--i": 2 } as React.CSSProperties} href="/">
              Back to the leaderboard
            </Link>
          </div>
        </section>
      </main>
      <div className="hints" />
    </div>
  );
}
