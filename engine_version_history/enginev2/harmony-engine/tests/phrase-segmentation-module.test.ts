import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PhraseSegmentationModule } from '../src/analyzer/phrase-segmentation-module.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

describe('PhraseSegmentationModule', () => {
  it('detects rest boundaries', () => {
    const measure1 = make_measure(1, [make_note('C', 0), make_note('E', 1)]);
    const measure2 = {
      number: 2,
      events: [{ type: 'rest' as const, duration: 'half' as const, dots: 0, beat: 0 }, make_note('G', 2)],
      chords: [],
    };
    const score = make_score([measure1, measure2]);

    const module = new PhraseSegmentationModule();
    const boundaries = module._find_candidate_boundaries(score);

    expect(boundaries.some((t) => Math.abs(t - 4) < 0.01)).toBe(true);
  });

  it('falls back to fixed windows when boundaries are unclear', () => {
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('D', 1), make_note('E', 2), make_note('F', 3)]),
      make_measure(2, [make_note('G', 0), make_note('A', 1), make_note('B', 2), make_note('C', 3)]),
    ]);

    const module = new PhraseSegmentationModule();
    const phrases = module.segment(score);

    expect(phrases.length).toBeGreaterThan(0);
  });

  it('Property: phrases cover the piece from start to end', () => {
    fc.assert(
      fc.property(fc.integer({ min: 4, max: 12 }), (nMeasures) => {
        const score = make_score(
          Array.from({ length: nMeasures }, (_, i) =>
            make_measure(i + 1, [
              make_note('C', 0),
              make_note('E', 1),
              make_note('G', 2),
              make_note('C', 3),
            ]),
          ),
        );

        const module = new PhraseSegmentationModule();
        const phrases = module.segment(score, 0);
        const total = nMeasures * 4;

        expect(phrases[0][0]).toBeCloseTo(0, 6);
        expect(phrases[phrases.length - 1][1]).toBeCloseTo(total, 6);

        for (let i = 1; i < phrases.length; i++) {
          expect(phrases[i][0]).toBeLessThanOrEqual(phrases[i - 1][1] + 0.001);
        }
      }),
      { numRuns: 50 },
    );
  });
});
