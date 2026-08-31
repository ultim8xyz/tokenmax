import Link from "next/link";
import { Rolling } from "./rolling";
import { Mark } from "./bevel";

const VIEWS: [string, string][] = [
  ["/", "Leaderboard"],
  ["/settings", "Settings"],
];

interface Props {
  /** Which nav entry reads as current. A member page is still the leaderboard —
   *  it is the same place, one level in. */
  active?: string;
  pot?: number;
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
          <Mark />
        </Link>
        {/* The board's own plate already carries pool and members as modules,
            so the rail would print the same two figures a row above them.
            A screen states a number once. Pages without those modules still
            pass `pot` and get the rail copy. */}
        {pot !== undefined && (
          <div className="pot">
            POOL <b><Rolling value={pot} format="usd0" /></b>
            &nbsp;·&nbsp; <b>{members ?? "—"}</b> members
          </div>
        )}
        <nav className="navs">
          {VIEWS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              prefetch
              className="nav"
              aria-current={String(active === href) as "true" | "false"}
            >
              {label}
            </Link>
          ))}
          {me && (
            <Link
              href={`/u/${me.username}`}
              prefetch
              className="nav me"
              aria-label={`Your profile, @${me.username}`}
              aria-current={String(active === `/u/${me.username}`) as "true" | "false"}
            >
              {me.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="pfp" src={me.avatarUrl} alt="" />
              ) : (
                <span className="pfp init">{me.username.slice(0, 1).toUpperCase()}</span>
              )}
            </Link>
          )}
        </nav>
      </header>

      <main id="stage">{children}</main>

      {/* #shell's third grid row is `auto`, so an empty band still claimed its
          own padding at the foot of every page. Nothing passes hints today. */}
      {hints ? <div className="hints">{hints}</div> : null}
    </div>
  );
}

/** The bare shell, for screens that carry no navigation of their own. */
export function PlainShell({ children }: { children: React.ReactNode }) {
  return (
    <div id="shell">
      <header className="rail">
        <Link href="/" className="brand" aria-label="Leaderboard">
          <Mark />
        </Link>
      </header>
      <main id="stage">{children}</main>
    </div>
  );
}
