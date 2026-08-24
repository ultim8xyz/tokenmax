/** Above this, in the last seven days, the greeting stops being encouraging. */
export const BEAST_THRESHOLD_USD = 1000;

export interface Verdict {
  headline: string;
  beast: boolean;
}

export function verdictFor(weekCostUsd: number): Verdict {
  return weekCostUsd >= BEAST_THRESHOLD_USD
    ? { headline: "You're a beast.", beast: true }
    : { headline: "Gotta step your game up.", beast: false };
}
