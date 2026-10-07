export function getConsistencyCellFill({
  active,
  activeFill,
  isFuture,
  shellColor,
}: {
  active: boolean;
  activeFill: string;
  isFuture: boolean;
  shellColor: string;
}) {
  if (isFuture || !active) {
    return shellColor;
  }

  return activeFill;
}

export function getConsistencyCellOpacity({
  active,
  activityCount,
  isFuture,
}: {
  active: boolean;
  activityCount: number;
  isFuture: boolean;
}) {
  if (isFuture) {
    return 0.42;
  }

  if (!active) {
    return 1;
  }

  if (activityCount >= 5) {
    return 0.86;
  }

  if (activityCount >= 3) {
    return 0.62;
  }

  return 0.38;
}
