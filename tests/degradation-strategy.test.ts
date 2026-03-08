import { describe, expect, it } from 'vitest';
import { CandidateLattice } from '../src/core/harmony-types.js';
import { DegradationStrategy } from '../src/perf/degradation-strategy.js';
import type { ChordCandidate } from '../src/core/harmony-types.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';

function candidate(roman: string, fn: ChordCandidate['function']): ChordCandidate {
  return {
    local_key: 'C major',
    mode: 'major',
    roman_numeral: roman,
    function: fn,
    root: roman.includes('V') ? 'G' : roman.includes('IV') ? 'F' : 'C',
    root_accidental: 'none',
    quality: roman === 'V7' ? 'dominant7' : 'major',
    inversion: 'root',
    extensions: [],
    alterations: [],
    confidence: 0.6,
    difficulty: 'basic',
    source: 'model',
    explanation: roman,
    melody_coverage: 0.8,
    beat_alignment: 0.8,
    function_fit: 0.8,
    style_fit: 0.7,
  };
}

describe('DegradationStrategy', () => {
  it('falls back to rule candidates when embedding service fails', () => {
    const strategy = new DegradationStrategy();
    const result = strategy.embedding_service_fallback({
      rule_candidates: [candidate('I', 'tonic')],
      transition_matrix: { I: { V: 0.8 } },
    });

    expect(result.candidates[0].source).toBe('rule');
    expect(result.used_transition_matrix).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('falls back to conservative DP decoding when LLM service fails', () => {
    const strategy = new DegradationStrategy();
    const lattice = new CandidateLattice(
      [[0, 1], [1, 2]],
      [
        [candidate('I', 'tonic'), candidate('vi', 'tonic')],
        [candidate('V', 'dominant'), candidate('I', 'tonic')],
      ],
    );

    const result = strategy.llm_service_fallback({
      lattice,
      context: {
        key_sequence: [{ key: 'C', start_time: 0, end_time: 2 }],
        difficulty: 'basic',
        style: 'hymn',
        phrase_boundaries: [[0, 2]],
      },
    });

    expect(result.decoded.chord_sequence).toHaveLength(2);
    expect(result.explanation).toContain('template');
  });

  it('returns guidance when OMR service is unavailable', () => {
    const strategy = new DegradationStrategy();
    const result = strategy.omr_service_fallback({ preprocessed_preview: 'preview://tmp/img.png' });

    expect(result.user_message).toContain('clearer image');
    expect(result.preview).toContain('preview://');
  });

  it('returns MusicXML and ABC when rendering service fails', () => {
    const strategy = new DegradationStrategy();
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('E', 1)]),
    ]);

    const result = strategy.rendering_service_fallback({
      musicxml: '<score-partwise/>',
      score,
    });

    expect(result.musicxml).toContain('score-partwise');
    expect(result.abc.length).toBeGreaterThan(0);
  });
});

