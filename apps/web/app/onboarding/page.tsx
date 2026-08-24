import { redirect } from "next/navigation";
import { requireAnyMember } from "@/lib/auth";
import { PlainShell } from "../console/shell";
import { HueDrift } from "../console/hue";
import { hueFor } from "@/lib/console/board";
import { ConnectMachine } from "./connect-machine";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const member = await requireAnyMember("/onboarding");
  if (member.onboardedAt) redirect("/");

  return (
    <PlainShell>
      <HueDrift hue={hueFor(member.username)} />
      <ConnectMachine
        handle={member.username}
        displayName={member.displayName}
        apiUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
        hue={hueFor(member.username)}
      />
    </PlainShell>
  );
}
