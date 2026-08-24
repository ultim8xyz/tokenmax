"use client";

import { useState } from "react";

type State = "idle" | "working" | "done" | "error";

export function ApproveForm({ code }: { code: string }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  async function approve() {
    setState("working");
    const res = await fetch("/api/auth/cli/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      setState("done");
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setMessage(body.error ?? "Could not approve that code");
    setState("error");
  }

  if (state === "done") {
    return (
      <div className="wait done rise" style={{ "--i": 4 } as React.CSSProperties}>
        <span className="d" />
        <span>Approved — your terminal will finish on its own.</span>
      </div>
    );
  }

  return (
    <>
      <button
        className="go rise"
        style={{ "--i": 4 } as React.CSSProperties}
        onClick={approve}
        disabled={state === "working" || !code}
      >
        {state === "working" ? "Approving…" : "Approve this device"}
      </button>
      {state === "error" && (
        <div className="wait rise" style={{ "--i": 5 } as React.CSSProperties}>
          <span className="d" />
          <span>{message}</span>
        </div>
      )}
    </>
  );
}
