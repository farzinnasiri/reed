export type EffortKind = "strength" | "hold" | "cardio";

/** RIR is an estimate for repetition sets; it is not a unit for timed work. */
export function effortLabel(rpe: number, kind: EffortKind) {
  if (kind !== "strength")
    return rpe >= 10
      ? "Max effort"
      : rpe >= 9
        ? "Very hard"
        : rpe >= 8
          ? "Hard"
          : rpe >= 7
            ? "Moderate"
            : "Easy";
  if (rpe >= 10) return "0 reps left";
  if (rpe >= 9.5) return "0–1 reps left";
  if (rpe >= 9) return "1 rep left";
  if (rpe >= 8.5) return "1–2 reps left";
  if (rpe >= 8) return "2 reps left";
  if (rpe >= 7.5) return "2–3 reps left";
  if (rpe >= 7) return "3 reps left";
  return "4+ reps left";
}
