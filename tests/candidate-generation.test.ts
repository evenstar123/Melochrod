import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CandidateLatticeGenerator } from '../src/candidate/candidate-lattice-generator.js';
import { ModelRouter } from '../src/candidate/model-router.js';
import { RuleRouter } from '../src/candidate/rule-router.js';
import { RetrievalRouter } from '../src/candidate/retrieval-router.js';
import { make_measure, make_note, make_score } from './helpers/sample-score.js';
import type { RetrievalProvider } from '../src/candidate/types.js';

class MockRetrievalProvider implements RetrievalProvider {
  async hybrid_search(): Promise<any[]> {
    return [{ id: 'r1', score: 0.7, chords: ['ii', 'V'] }];
  }
}

describe('candidate routers', () => {
  it('RuleRouter generates functional candidates with melody coverage', () => {
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
    ]);

    const router = new RuleRouter();
    const candidates = router.generate({
      score,
      time_span: [0, 4],
      span_index: 0,
      key_context: { key: 'C', mode: 'major', confidence: 0.9, start_time: 0, end_time: 4 },
      difficulty: 'basic',
      style: 'hymn',
      phrase_boundaries: [[0, 4]],
      functional_state: 'tonic',
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.source === 'rule')).toBe(true);
    expect(candidates.some((candidate) => candidate.roman_numeral === 'I')).toBe(true);
  });

  it('RetrievalRouter converts retrieval hits into candidates', async () => {
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('D', 1), make_note('E', 2), make_note('G', 3)]),
    ]);

    const router = new RetrievalRouter(new MockRetrievalProvider());
    const candidates = await router.generate({
      score,
      time_span: [0, 4],
      span_index: 0,
      key_context: { key: 'C', mode: 'major', confidence: 0.8, start_time: 0, end_time: 4 },
      difficulty: 'intermediate',
      style: 'pop',
      phrase_boundaries: [[0, 4]],
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.source === 'retrieval')).toBe(true);
  });

  it('ModelRouter prioritizes local symbolic model when confidence is high', async () => {
    const router = new ModelRouter({
      symbolic_model: {
        predict_candidates: () => ({
          confidence: 0.9,
          candidates: [{
            local_key: 'C major',
            mode: 'major',
            roman_numeral: 'I',
            function: 'tonic',
            root: 'C',
            root_accidental: 'none',
            quality: 'major',
            inversion: 'root',
            extensions: [],
            alterations: [],
            confidence: 0.9,
            difficulty: 'basic',
            source: 'model',
            explanation: 'symbolic',
            melody_coverage: 0.8,
            beat_alignment: 0.8,
            function_fit: 0.9,
            style_fit: 0.7,
          }],
        }),
      },
    });

    const score = make_score([make_measure(1, [make_note('C', 0)])]);
    const candidates = await router.generate({
      score,
      time_span: [0, 1],
      span_index: 0,
      key_context: { key: 'C', mode: 'major', confidence: 0.8, start_time: 0, end_time: 1 },
      difficulty: 'basic',
      style: 'hymn',
      phrase_boundaries: [[0, 1]],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].explanation).toContain('symbolic');
  });

  it('CandidateLatticeGenerator merges and deduplicates candidates', async () => {
    const score = make_score([
      make_measure(1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('C', 3)]),
      make_measure(2, [make_note('F', 0), make_note('A', 1), make_note('C', 2), make_note('G', 3)]),
    ]);

    const generator = new CandidateLatticeGenerator({
      retrieval_router: new RetrievalRouter(new MockRetrievalProvider()),
      model_router: new ModelRouter(),
    });

    const lattice = await generator.generate({
      score,
      time_spans: [[0, 2], [2, 4], [4, 6], [6, 8]],
      key_sequence: [
        { key: 'C', mode: 'major', confidence: 0.9, start_time: 0, end_time: 8 },
      ],
      difficulty: 'intermediate',
      style: 'pop',
      phrase_boundaries: [[0, 8]],
    });

    expect(lattice.time_spans).toHaveLength(4);
    expect(lattice.get_candidates(0).length).toBeGreaterThan(0);
  });

  it('Property: generated candidates have valid roots and qualities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 6 }),
        async (spanCount) => {
          const score = make_score([
            make_measure(1, [make_note('C', 0), make_note('E', 1), make_note('G', 2), make_note('B', 3)]),
          ]);

          const generator = new CandidateLatticeGenerator();
          const spans = Array.from({ length: spanCount }, (_, i) => [i, i + 1] as const);

          const lattice = await generator.generate({
            score,
            time_spans: spans,
            key_sequence: [{ key: 'C', mode: 'major', confidence: 0.8, start_time: 0, end_time: spanCount }],
            difficulty: 'basic',
            style: 'hymn',
            phrase_boundaries: [[0, spanCount]],
          });

          for (let i = 0; i < spanCount; i++) {
            for (const candidate of lattice.get_candidates(i)) {
              expect(candidate.root).toMatch(/[A-G]/);
              expect(candidate.quality.length).toBeGreaterThan(0);
              expect(candidate.local_key.length).toBeGreaterThan(0);
            }
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});
