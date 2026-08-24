"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { installCommand } from "@/lib/console/cli";
import { runFlight } from "@/lib/console/flight";
import { Flight } from "./flight";

const POLL_MS = 4000;

interface Device {
  name: string;
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
  const [copied, setCopied] = useState(false);

  // The instance is compiled into the CLI, so the command is the command.
  const command = installCommand("login");

  useEffect(() => {
    let live = true;
    async function poll() {
      const res = await fetch("/api/onboarding/status", { cache: "no-store" });
      if (!res.ok || !live) return;
      const body = (await res.json()) as { onboarded: boolean; devices: Device[] };
      setDevices(body.devices);
      setConnected(body.onboarded);
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
          Signed in as @{handle}. Run this where you code — on every machine you code on.
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
          <button onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        </div>

        <div className={`wait rise${connected ? " done" : ""}`} style={style(5)}>
          <span className="d" />
          <span>
            {connected ? (
              <>
                Connected — <b>{devices.map((d) => d.name).join(", ")}</b> reported in
              </>
            ) : devices.length > 0 ? (
              <>
                <b>{devices.map((d) => d.name).join(", ")}</b> signed in — waiting for the
                first push…
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
