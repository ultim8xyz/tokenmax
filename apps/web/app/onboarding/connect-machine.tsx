"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CLI_SOURCE } from "@/lib/console/cli";
import { usd } from "@/lib/console/board";
import { verdictFor } from "@/lib/console/verdict";
import { runFlight } from "@/lib/console/flight";
import { Flight } from "./flight";

const POLL_MS = 4000;

interface Device {
  name: string;
}

interface Status {
  onboarded: boolean;
  devices: Device[];
  week: { cost_usd: number; total_tokens: number };
}

export function ConnectMachine({
  handle,
  displayName,
  hue,
}: {
  handle: string;
  displayName: string | null;
  hue: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(displayName ?? "");
  const [saved, setSaved] = useState(displayName ?? "");
  const [devices, setDevices] = useState<Device[]>([]);
  const [connected, setConnected] = useState(false);
  const [week, setWeek] = useState(0);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The code is minted here, so running it needs no second browser trip: this
  // page has already proved who you are.
  useEffect(() => {
    let live = true;
    fetch("/api/auth/cli/enroll", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (live && b?.code) setCode(b.code as string);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const command = code ? `npx ${CLI_SOURCE} setup ${code}` : `npx ${CLI_SOURCE} setup …`;

  useEffect(() => {
    let live = true;
    async function poll() {
      const res = await fetch("/api/onboarding/status", { cache: "no-store" });
      if (!res.ok || !live) return;
      const body = (await res.json()) as Status;
      setDevices(body.devices);
      setConnected(body.onboarded);
      setWeek(body.week.cost_usd);
    }
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  // The alias is saved as you leave the field, so Enter is never blocked on it.
  async function saveName() {
    if (name.trim() === saved) return;
    const res = await fetch("/api/profile/display-name", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: name.trim() || null }),
    });
    if (res.ok) setSaved(name.trim());
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard?.writeText(command).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  const style = (i: number) => ({ "--i": i }) as React.CSSProperties;

  function depart() {
    const host = flightRef.current;
    const form = formRef.current;
    if (!host || !form) {
      router.replace("/");
      return;
    }
    runFlight({
      host,
      form,
      name: saved || handle,
      subtitle: devices.length
        ? `${devices.map((d) => d.name).join(", ")} is reporting. You are on the board.`
        : "You are on the board.",
      hue,
    });
  }

  return (
    <section className="view on" id="onboard">
      <div className="ob" id="obwrap" ref={formRef}>
        <div className="steps rise" style={style(0)}>
          <span>Step 02 of 02</span>
          <i className="on" />
          <i className="on" />
        </div>

        <h2 className="rise" style={style(1)}>
          Connect a machine
        </h2>
        <p className="rise" style={style(2)}>
          Signed in as @{handle}. Paste this where you code — no second sign-in, it links the
          machine and pushes in one go.
        </p>

        <div className="field rise" style={style(3)}>
          <label htmlFor="alias">Display name — optional</label>
          <input
            id="alias"
            value={name}
            placeholder={handle}
            maxLength={32}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            aria-label="Display name, optional"
          />
          <div className="hint">Blank keeps your GitHub handle.</div>
        </div>

        <div className="cmd rise" style={style(4)}>
          <code>{command}</code>
          <button onClick={copy} disabled={!code}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className={`wait rise${connected ? " done" : ""}`} style={style(5)}>
          <span className="d" />
          <span>
            {connected ? (
              <>
                Push received from <b>{devices.map((d) => d.name).join(", ")}</b> — stats
                compiled. <b>{usd(week)}</b> in the past 7 days.{" "}
                {verdictFor(week).headline}
              </>
            ) : (
              "Waiting for your first push…"
            )}
          </span>
        </div>

        <button
          className="go rise"
          style={style(6)}
          disabled={!connected}
          onClick={depart}
        >
          Enter tokenmax
        </button>
      </div>

      <Flight ref={flightRef} onEnter={() => router.replace("/")} />
    </section>
  );
}
