import { describe, expect, it } from 'vitest';
import { EvaluationMetrics } from '../src/perf/evaluation-metrics.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

describe('EvaluationMetrics', () => {
  it('computes CHE correctly', () => {
    const metrics = new EvaluationMetrics();
    const che = metrics.compute_che(['I', 'IV', 'V', 'I'], ['I', 'ii', 'V', 'I']);
    expect(che).toBe(0.25);
  });

  it('computes melody-chord consistency metrics', () => {
    const metrics = new EvaluationMetrics();
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('D', 3)]),
    ]);
    score.measures[0].chords = [
      { root: 'C', rootAccidental: 'none', quality: 'major', beat: 0 },
      { root: 'G', rootAccidental: 'none', quality: 'major', beat: 2 },
    ];

    const ctnctr = metrics.compute_ctnctr(score);
    const pcs = metrics.compute_pcs(['C', 'G'], ['C', 'F']);
    const mctd = metrics.compute_mctd(score);

    expect(ctnctr).toBeGreaterThan(0);
    expect(pcs).toBeGreaterThanOrEqual(0);
    expect(pcs).toBeLessThanOrEqual(1);
    expect(mctd).toBeGreaterThanOrEqual(0);
  });

  it('detects cadences and returns precision/recall/F1', () => {
    const metrics = new EvaluationMetrics();
    const cadence = metrics.compute_cadence_metrics(
      ['I', 'V', 'I', 'IV', 'V', 'I'],
      ['I', 'V', 'I', 'ii', 'V', 'I'],
    );

    expect(cadence.precision).toBeGreaterThan(0);
    expect(cadence.recall).toBeGreaterThan(0);
    expect(cadence.f1).toBeGreaterThan(0);
  });
});

