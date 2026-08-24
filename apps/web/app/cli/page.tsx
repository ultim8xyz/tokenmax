import { requireAnyMember } from "@/lib/auth";
import { PlainShell } from "../console/shell";
import { ApproveForm } from "./approve-form";

export const dynamic = "force-dynamic";

export default async function CliPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code = "" } = await searchParams;
  await requireAnyMember(`/cli?code=${code}`);

  return (
    <PlainShell>
      <section className="view on" id="onboard">
        <div className="ob">
          <div className="steps rise" style={{ "--i": 0 } as React.CSSProperties}>
            <span>Device login</span>
            <i className="on" />
            <i className="on" />
          </div>
          <h2 className="rise" style={{ "--i": 1 } as React.CSSProperties}>
            Confirm the code
          </h2>
          <p className="rise" style={{ "--i": 2 } as React.CSSProperties}>
            It should match what your terminal is showing.
          </p>
          <div className="cmd rise" style={{ "--i": 3 } as React.CSSProperties}>
            <code>{code || "—"}</code>
          </div>
          <ApproveForm code={code} />
        </div>
      </section>
    </PlainShell>
  );
}
