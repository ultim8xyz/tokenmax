"use client";

import { useState } from "react";
import { CLI_SOURCE } from "@/lib/console/cli";

const command = (code: string) => `npx ${CLI_SOURCE} setup ${code}`;

export function AliasRow({ username, initial }: { username: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (value.trim() === saved) return;
    setBusy(true);
    const res = await fetch("/api/profile/display-name", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: value.trim() || null }),
    });
    if (res.ok) setSaved(value.trim());
    setBusy(false);
  }

  return (
    <div className="srow">
      <div>
        <div className="t">Display name</div>
        <div className="d">
          Shown as {saved || username}. Blank keeps your GitHub handle.
        </div>
      </div>
      <div className="field" style={{ minWidth: "min(28ch, 40vw)" }}>
        <input
          value={value}
          placeholder={username}
          maxLength={32}
          aria-label="Display name"
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          disabled={busy}
        />
      </div>
    </div>
  );
}

export function MachineRow() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function mint() {
    setBusy(true);
    const res = await fetch("/api/auth/cli/enroll", { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { code?: string };
    if (body.code) setCode(body.code);
    setBusy(false);
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard?.writeText(command(code)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="srow" style={{ alignItems: "start" }}>
      <div>
        <div className="t">Add a machine</div>
        <div className="d">
          Run this on any machine you code on. Each gets its own id, so days are summed
          across them and a re-push replaces only that machine&apos;s row. The code is
          single-use and lasts 30 minutes.
        </div>
        {code && (
          <div className="cmd" style={{ marginTop: 12 }}>
            <code>{command(code)}</code>
            <button onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          </div>
        )}
      </div>
      <button className="button-like nav" onClick={mint} disabled={busy}>
        {busy ? "…" : code ? "New code" : "Get a code"}
      </button>
    </div>
  );
}
