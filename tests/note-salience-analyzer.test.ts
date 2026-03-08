import { describe, expect, it } from 'vitest';
import { NoteSalienceAnalyzer } from '../src/analyzer/note-salience-analyzer.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

describe('NoteSalienceAnalyzer', () => {
  it('annotates notes with salience and beat features', () => {
    const score = make_score([
      make_measure(1, [
        make_note('C', 0, { duration: 'half' }),
        make_note('D', 2),
      ]),
    ]);

    const analyzer = new NoteSalienceAnalyzer();
    analyzer.analyze(score, [[0, 4]]);

    const note0 = score.measures[0].events[0];
    expect(note0.type).toBe('note');
    if (note0.type === 'note') {
      expect(note0.is_downbeat).toBe(true);
      expect(note0.salience).toBeGreaterThan(0);
      expect(note0.phrase_boundary).toBe(false);
    }
  });
});
