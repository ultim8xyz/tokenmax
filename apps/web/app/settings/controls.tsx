"use client";

import { useState } from "react";

export function Toggle({
  title,
  detail,
  initial,
}: {
  title: string;
  detail: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function flip() {
    const next = !on;
    setBusy(true);
    const res = await fetch("/api/profile/listing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_listed: next }),
    });
    if (res.ok) setOn(next);
    setBusy(false);
  }

  return (
    <div className="srow">
      <div>
        <div className="t">{title}</div>
        <div className="d">{detail}</div>
      </div>
      <button
        className="sw"
        aria-pressed={String(on) as "true" | "false"}
        aria-label={title}
        disabled={busy}
        onClick={flip}
      />
    </div>
  );
}

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

export function InviteRow({ initial }: { initial: string[] }) {
  const [pending, setPending] = useState(initial);
  const [login, setLogin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(method: "POST" | "DELETE", value: string) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/invites", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ github_login: value }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; github_login?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong");
      return null;
    }
    return body.github_login ?? value.trim().toLowerCase();
  }

  return (
    <div className="srow" style={{ alignItems: "start" }}>
      <div>
        <div className="t">Invites</div>
        <div className="d">
          {pending.length === 0
            ? "No pending invites."
            : pending.join(", ") + " — invited, not signed in yet"}
        </div>
        {error && <div className="d">{error}</div>}
      </div>
      <div className="field" style={{ minWidth: "min(28ch, 40vw)" }}>
        <input
          value={login}
          placeholder="github-username"
          aria-label="GitHub username to invite"
          onChange={(e) => setLogin(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key !== "Enter" || !login.trim()) return;
            const added = await send("POST", login);
            if (!added) return;
            setPending((c) => (c.includes(added) ? c : [...c, added]));
            setLogin("");
          }}
          disabled={busy}
        />
        <div className="hint">Press Enter to invite.</div>
      </div>
    </div>
  );
}
