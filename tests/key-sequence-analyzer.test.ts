import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { KeySequenceAnalyzer } from '../src/analyzer/key-sequence-analyzer.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

describe('KeySequenceAnalyzer', () => {
  it('detects key on a simple C-major melody', () => {
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
      make_measure(2, [make_note('D', 0), make_note('F', 1), make_note('A', 2), make_note('G', 3)]),
      make_measure(3, [make_note('E', 0), make_note('G', 1), make_note('B', 2), make_note('C', 3)]),
    ]);

    const analyzer = new KeySequenceAnalyzer();
    const result = analyzer.analyze(score, 4);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].key).toBe('C');
    expect(result[0].mode).toBe('major');
  });

  it('detects modulation tendency from C to G major', () => {
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
      make_measure(2, [make_note('D', 0), make_note('F', 1), make_note('A', 2), make_note('G', 3)]),
      make_measure(3, [make_note('G', 0), make_note('B', 1), make_note('D', 2), make_note('F', 3, { accidental: 'sharp' })]),
      make_measure(4, [make_note('G', 0), make_note('B', 1), make_note('D', 2), make_note('G', 3)]),
    ]);

    const analyzer = new KeySequenceAnalyzer();
    const result = analyzer.analyze(score, 4);

    const keys = result.map((entry) => `${entry.key} ${entry.mode}`);
    expect(keys.some((value) => value === 'G major')).toBe(true);
  });

  it('Property: key sequence has inertia and does not switch every window', () => {
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

        const analyzer = new KeySequenceAnalyzer();
        const result = analyzer.analyze(score, 4);

        let changes = 0;
        for (let i = 1; i < result.length; i++) {
          if (result[i].key !== result[i - 1].key || result[i].mode !== result[i - 1].mode) {
            changes += 1;
          }
        }

        expect(changes).toBeLessThanOrEqual(Math.floor(result.length / 2));
      }),
      { numRuns: 40 },
    );
  });
});
