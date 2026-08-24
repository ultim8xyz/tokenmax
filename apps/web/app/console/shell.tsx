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
  /** The viewer, for the way back to their own profile. */
  me?: { username: string; avatarUrl: string | null };
  children: React.ReactNode;
}

export function Shell({ active, pot, members, hints, me, children }: Props) {
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
          {me && (
            <Link
              href={`/u/${me.username}`}
              className="nav me"
              aria-label={`Your profile, @${me.username}`}
              aria-current={String(active === `/u/${me.username}`) as "true" | "false"}
            >
              {me.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="pfp" src={me.avatarUrl} alt="" />
              ) : (
                <span className="pfp" />
              )}
            </Link>
          )}
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
