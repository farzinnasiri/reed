export type BodyMeasurementTrendPoint = {
  observedAt: number;
  unit: string;
  value: number;
};

export function buildBodyweightTrend(args: {
  points: BodyMeasurementTrendPoint[];
  windowEndAt: number;
  windowStartAt: number;
}) {
  const points = [...args.points].sort((left, right) => left.observedAt - right.observedAt);
  const first = points[0] ?? null;
  const latest = points.at(-1) ?? null;
  const delta = first && latest ? latest.value - first.value : null;

  return {
    delta,
    first,
    latest,
    pointCount: points.length,
    points,
    window: {
      endAt: args.windowEndAt,
      startAt: args.windowStartAt,
    },
  };
}
