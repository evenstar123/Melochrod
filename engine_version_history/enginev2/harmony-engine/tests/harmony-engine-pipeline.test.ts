import { describe, expect, it } from 'vitest';
import { HarmonyEnginePipeline } from '../src/harmonizer/harmony-engine-pipeline.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

describe('HarmonyEnginePipeline', () => {
  it('runs end-to-end and writes chord symbols back to score', async () => {
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
      make_measure(2, [make_note('F', 0), make_note('A', 1), make_note('C', 2), make_note('G', 3)]),
    ]);

    const pipeline = new HarmonyEnginePipeline();
    const result = await pipeline.run(score, { difficulty: 'basic', style: 'hymn' });

    expect(result.time_spans.length).toBeGreaterThan(0);
    expect(result.key_sequence.length).toBeGreaterThan(0);
    expect(result.score.measures.some((measure) => measure.chords.length > 0)).toBe(true);
    expect(result.confidence.overall_confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence.overall_confidence).toBeLessThanOrEqual(1);
  });
});
