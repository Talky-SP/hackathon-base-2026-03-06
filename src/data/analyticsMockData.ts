import type { DocType, ErrorCategory } from '../types/golden';

export interface AnalyticsDataPoint {
  date: string;
  accuracy: number;
  passRate: number;
  totalDocs: number;
  passedDocs: number;
  failedDocs: number;
  byDocType: Record<DocType, { accuracy: number; docs: number; passed: number; failed: number }>;
  errorCounts: Partial<Record<ErrorCategory, number>>;
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const errorCats: ErrorCategory[] = [
  'missing_field', 'wrong_amount', 'wrong_date', 'wrong_supplier',
  'ocr_error', 'duplicate', 'format_error', 'calculation_error',
];

const docTypes: DocType[] = ['expense', 'income', 'payroll', 'delivery_note'];

function generateWeeklyData(): AnalyticsDataPoint[] {
  const rand = seeded(314159);
  const points: AnalyticsDataPoint[] = [];

  // 16 weeks of data, accuracy generally improving
  const baseAccuracy = 62;
  const weeks = 16;

  for (let w = 0; w < weeks; w++) {
    const date = new Date(2025, 10, 18 + w * 7); // Nov 18 2025 onwards
    const dateStr = date.toISOString().split('T')[0];

    // Accuracy improves with some noise
    const progress = w / (weeks - 1);
    const noise = (rand() - 0.5) * 8;
    const accuracy = Math.min(97, Math.max(55, Math.round(baseAccuracy + progress * 28 + noise)));

    const totalDocs = Math.round(80 + w * 15 + rand() * 30);
    const passRate = Math.min(98, Math.max(40, accuracy + Math.round((rand() - 0.3) * 10)));
    const passedDocs = Math.round(totalDocs * passRate / 100);
    const failedDocs = totalDocs - passedDocs;

    // Per doc type - each improves at different rates
    const dtRates: Record<DocType, number> = {
      expense: 0.85 + progress * 0.12,
      income: 0.78 + progress * 0.18,
      payroll: 0.70 + progress * 0.22,
      delivery_note: 0.65 + progress * 0.25,
    };

    const byDocType = {} as Record<DocType, { accuracy: number; docs: number; passed: number; failed: number }>;
    docTypes.forEach(dt => {
      const dtDocs = Math.round(totalDocs * (dt === 'expense' ? 0.35 : dt === 'income' ? 0.25 : dt === 'payroll' ? 0.2 : 0.2));
      const dtAcc = Math.min(98, Math.max(45, Math.round((dtRates[dt] + (rand() - 0.5) * 0.08) * 100)));
      const dtPassed = Math.round(dtDocs * (dtAcc + (rand() - 0.3) * 5) / 100);
      byDocType[dt] = {
        accuracy: dtAcc,
        docs: dtDocs,
        passed: Math.min(dtDocs, Math.max(0, dtPassed)),
        failed: Math.max(0, dtDocs - dtPassed),
      };
    });

    // Error counts - generally decreasing as accuracy improves
    const errorScale = 1 - progress * 0.6;
    const errorCounts: Partial<Record<ErrorCategory, number>> = {};
    errorCats.forEach(cat => {
      const baseCount = cat === 'missing_field' ? 18 : cat === 'wrong_amount' ? 14 :
        cat === 'ocr_error' ? 12 : cat === 'wrong_date' ? 10 :
        cat === 'format_error' ? 8 : cat === 'wrong_supplier' ? 7 :
        cat === 'calculation_error' ? 6 : 4;
      const count = Math.max(0, Math.round(baseCount * errorScale + (rand() - 0.5) * 6));
      if (count > 0) errorCounts[cat] = count;
    });

    points.push({ date: dateStr, accuracy, passRate, totalDocs, passedDocs, failedDocs, byDocType, errorCounts });
  }

  return points;
}

export const ANALYTICS_WEEKLY_DATA = generateWeeklyData();

// Current period (last 4 weeks) vs previous (4 weeks before that)
export function getPeriodComparison() {
  const data = ANALYTICS_WEEKLY_DATA;
  const recent = data.slice(-4);
  const previous = data.slice(-8, -4);

  const avg = (arr: AnalyticsDataPoint[], fn: (d: AnalyticsDataPoint) => number) =>
    arr.length > 0 ? Math.round(arr.reduce((s, d) => s + fn(d), 0) / arr.length) : 0;

  const sum = (arr: AnalyticsDataPoint[], fn: (d: AnalyticsDataPoint) => number) =>
    arr.reduce((s, d) => s + fn(d), 0);

  return {
    accuracy: { current: avg(recent, d => d.accuracy), previous: avg(previous, d => d.accuracy) },
    passRate: { current: avg(recent, d => d.passRate), previous: avg(previous, d => d.passRate) },
    totalDocs: { current: sum(recent, d => d.totalDocs), previous: sum(previous, d => d.totalDocs) },
    failedDocs: { current: sum(recent, d => d.failedDocs), previous: sum(previous, d => d.failedDocs) },
  };
}
