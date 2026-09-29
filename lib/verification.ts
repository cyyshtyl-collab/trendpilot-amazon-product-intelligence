export const DECISION_FIELDS = ['BSR', '趋势', '毛利'] as const;

export type DecisionField = (typeof DECISION_FIELDS)[number];

export type DecisionMetricUpdate = {
  bsr?: number;
  trend?: number;
  margin?: number;
};

export type DecisionEvidenceSources = Partial<Record<DecisionField, string>>;

export type VerificationEntry = {
  field: DecisionField;
  source: string;
};

const UPDATE_FIELD_MAP: ReadonlyArray<{
  key: keyof DecisionMetricUpdate;
  field: DecisionField;
}> = [
  { key: 'bsr', field: 'BSR' },
  { key: 'trend', field: '趋势' },
  { key: 'margin', field: '毛利' },
];

/** Builds one auditable evidence row per submitted decision metric. */
export function verificationEntries(
  update: DecisionMetricUpdate,
  sources: DecisionEvidenceSources,
  legacySource = '',
): VerificationEntry[] {
  return UPDATE_FIELD_MAP.flatMap(({ key, field }) => {
    if (update[key] === undefined) return [];
    const source = (sources[field] ?? legacySource).trim().slice(0, 240);
    return [{ field, source }];
  });
}
