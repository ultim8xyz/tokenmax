"use client";

/** Catches what breaks the root layout itself, where error.tsx cannot reach. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#04060c",
          color: "#eef2ff",
          font: "15px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div>
          <p style={{ opacity: 0.6, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            tokenmax — root failure
          </p>
          <p>{error.message || "No message came with it."}</p>
          {error.digest && <p style={{ opacity: 0.6 }}>digest {error.digest}</p>}
          <a
            href="/"
            style={{
              display: "inline-block",
              marginTop: "1rem",
              marginRight: "0.6rem",
              color: "inherit",
              textDecoration: "none",
              border: "1px solid #2a3550",
              borderRadius: 999,
              padding: "10px 20px",
            }}
          >
            back to the leaderboard
          </a>
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              font: "inherit",
              color: "inherit",
              background: "none",
              border: "1px solid #2a3550",
              borderRadius: 999,
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            try again
          </button>
        </div>
      </body>
    </html>
  );
}
