import { describe, expect, it } from 'vitest';
import { FunctionalStateTracker } from '../src/harmonizer/functional-state-tracker.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

describe('FunctionalStateTracker', () => {
  it('starts phrase in tonic state and moves toward cadence at phrase end', () => {
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
      make_measure(2, [make_note('F', 0), make_note('A', 1), make_note('C', 2), make_note('F', 3)]),
      make_measure(3, [make_note('B', 0), make_note('D', 1), make_note('G', 2), make_note('C', 3)]),
    ]);

    const tracker = new FunctionalStateTracker();
    const states = tracker.track(
      score,
      [
        { start_time: 0, end_time: 4, key: 'C', mode: 'major' },
        { start_time: 4, end_time: 8, key: 'C', mode: 'major' },
        { start_time: 8, end_time: 12, key: 'C', mode: 'major' },
      ],
      [[0, 12]],
    );

    expect(states[0]).toBe('tonic');
    expect(['cadence_preparation', 'cadence_resolution', 'dominant']).toContain(states[2]);
  });

  it('returns legal allowed chords by state and difficulty', () => {
    const tracker = new FunctionalStateTracker();

    const basic = tracker.get_allowed_chords('dominant', 'basic');
    const advanced = tracker.get_allowed_chords('cadence_preparation', 'advanced');

    expect(basic.every((chord) => ['I', 'IV', 'V', 'vi', 'i', 'iv', 'v'].includes(chord))).toBe(true);
    expect(advanced.some((chord) => chord.includes('/'))).toBe(true);
  });

  it('boosts cadence and dominant states with higher weights', () => {
    const tracker = new FunctionalStateTracker();

    expect(tracker.boost_cadence_weight('cadence_preparation')).toBe(1.5);
    expect(tracker.boost_cadence_weight('dominant')).toBe(1.2);
    expect(tracker.boost_cadence_weight('tonic')).toBe(1);
  });
});
