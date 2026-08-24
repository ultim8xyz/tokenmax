import Link from "next/link";

const VIEWS: [string, string][] = [
  ["/", "Leaderboard"],
  ["/settings", "Settings"],
];

interface Props {
  /** Which nav entry reads as current. A member page is still the leaderboard —
   *  it is the same place, one level in. */
  active?: string;
  pot?: string;
  members?: number;
  hints?: React.ReactNode;
  children: React.ReactNode;
}

export function Shell({ active, pot, members, hints, children }: Props) {
  return (
    <div id="shell">
      <header className="rail">
        <Link href="/" className="brand" aria-label="Leaderboard">
          TOKEN<em>MAX</em>
        </Link>
        <div className="pot">
          POOL <b>{pot ?? "—"}</b> &nbsp;/&nbsp; <b>{members ?? "—"}</b> MEMBERS
        </div>
        <nav className="navs">
          {VIEWS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="nav"
              aria-current={String(active === href) as "true" | "false"}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main id="stage">{children}</main>

      <div className="hints">{hints}</div>
    </div>
  );
}

/** The bare shell, for screens that carry no navigation of their own. */
export function PlainShell({ children }: { children: React.ReactNode }) {
  return (
    <div id="shell">
      <header className="rail">
        <Link href="/" className="brand" aria-label="Leaderboard">
          TOKEN<em>MAX</em>
        </Link>
      </header>
      <main id="stage">{children}</main>
      <div className="hints" />
    </div>
  );
}
