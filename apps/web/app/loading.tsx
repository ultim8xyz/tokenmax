/**
 * The chrome, immediately.
 *
 * Every page is rendered per request behind an auth check, so without this the
 * browser holds the previous page until the new one is ready. The rail and the
 * backdrop are the same on all of them, so they can be on screen while the
 * numbers are still coming.
 */
export default function Loading() {
  return (
    <div id="shell">
      <header className="rail">
        <div className="brand">
          TOKEN<em>MAX</em>
        </div>
        <div className="pot">
          POOL <b>—</b> &nbsp;/&nbsp; <b>—</b> MEMBERS
        </div>
      </header>
      <main id="stage">
        <section className="view on">
          <div style={{ display: "grid", placeContent: "center" }}>
            <span className="label">loading</span>
          </div>
        </section>
      </main>
      <div className="hints" />
    </div>
  );
}
