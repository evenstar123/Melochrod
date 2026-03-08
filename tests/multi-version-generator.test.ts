import { describe, expect, it } from 'vitest';
import { MultiVersionGenerator } from '../src/harmonizer/multi-version-generator.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

describe('MultiVersionGenerator', () => {
  it('generates three distinct harmony versions', async () => {
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
      make_measure(2, [make_note('F', 0), make_note('A', 1), make_note('C', 2), make_note('A', 3)]),
      make_measure(3, [make_note('G', 0), make_note('B', 1), make_note('D', 2), make_note('G', 3)]),
      make_measure(4, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
    ]);

    const generator = new MultiVersionGenerator();
    const versions = await generator.generate({
      score,
      key_sequence: [{ key: 'C', mode: 'major', confidence: 0.9, start_time: 0, end_time: 16 }],
      time_spans: [[0, 4], [4, 8], [8, 12], [12, 16]],
      phrase_boundaries: [[0, 16]],
    });

    expect(versions).toHaveLength(3);
    expect(new Set(versions.map((v) => v.difficulty))).toEqual(new Set(['basic', 'intermediate', 'advanced']));
    expect(new Set(versions.map((v) => v.style))).toEqual(new Set(['hymn', 'pop', 'jazz-lite']));

    const complexity = versions.map((version) =>
      version.chord_sequence.reduce((sum, chord) => sum + chord.extensions.length + chord.alterations.length, 0),
    );
    expect(complexity[2]).toBeGreaterThanOrEqual(complexity[0]);
  });
});
