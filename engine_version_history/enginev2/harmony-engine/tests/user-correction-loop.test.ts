import { describe, expect, it } from 'vitest';
import type { ChordCandidate } from '../src/core/harmony-types.js';
import { UserCorrectionLoop } from '../src/harmonizer/user-correction-loop.js';

function candidate(roman: string, confidence: number): ChordCandidate {
  return {
    local_key: 'C major',
    mode: 'major',
    roman_numeral: roman,
    function: roman === 'V' ? 'dominant' : 'tonic',
    root: roman === 'V' ? 'G' : 'C',
    root_accidental: 'none',
    quality: 'major',
    inversion: 'root',
    extensions: [],
    alterations: [],
    confidence,
    difficulty: 'basic',
    source: 'rule',
    explanation: roman,
    melody_coverage: 0.8,
    beat_alignment: 0.8,
    function_fit: 0.8,
    style_fit: 0.6,
  };
}

describe('UserCorrectionLoop', () => {
  it('tracks acceptance/rejection/modification events', () => {
    const loop = new UserCorrectionLoop();
    loop.record_acceptance({
      user_id: 'u1',
      institution_id: 'inst',
      role: 'teacher',
      position: 1,
      new_chord: 'I',
    });
    loop.record_rejection({
      user_id: 'u1',
      institution_id: 'inst',
      role: 'teacher',
      position: 2,
      original_chord: 'iii',
    });
    loop.record_modification({
      user_id: 'u1',
      institution_id: 'inst',
      role: 'student',
      position: 3,
      original_chord: 'IV',
      new_chord: 'ii',
      context: { previous_chord: 'V' },
    });

    const analysis = loop.analyze_corrections();
    expect(analysis.total_events).toBe(3);
    expect(analysis.by_role.teacher).toBe(2);
    expect(analysis.by_role.student).toBe(1);
    expect(analysis.frequently_modified_positions.length).toBeGreaterThan(0);
  });

  it('builds user and institution style profiles', () => {
    const loop = new UserCorrectionLoop();
    loop.record_modification({
      user_id: 'u1',
      institution_id: 'inst',
      role: 'teacher',
      position: 1,
      original_chord: 'IV',
      new_chord: 'ii',
      context: { previous_chord: 'V' },
    });
    loop.record_modification({
      user_id: 'u1',
      institution_id: 'inst',
      role: 'teacher',
      position: 2,
      original_chord: 'viio',
      new_chord: 'V',
      context: { previous_chord: 'ii' },
    });
    loop.upload_institution_corpus('inst', [['I', 'V', 'vi', 'IV'], ['ii', 'V', 'I']]);

    const userProfile = loop.build_user_style_profile('u1');
    const institutionProfile = loop.build_institution_style_profile('inst');
    expect(userProfile.preferred_chords).toContain('ii');
    expect(institutionProfile.preferred_progressions.length).toBeGreaterThan(0);
  });

  it('reranks candidates using preference profiles', () => {
    const loop = new UserCorrectionLoop();
    const reranked = loop.rerank_candidates(
      [candidate('ii', 0.5), candidate('IV', 0.7)],
      {
        user_profile: {
          profile_id: 'user:u1',
          preferred_chords: ['ii'],
          rejected_chords: ['IV'],
          preferred_progressions: ['V->ii'],
        },
        previous_chord: 'V',
      },
    );

    expect(reranked[0].roman_numeral).toBe('ii');
    expect(reranked[0].confidence).toBeGreaterThan(reranked[1].confidence);
  });
});

