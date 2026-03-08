import type {
  CandidateLatticeTransitionQuery,
  ChordCandidate,
  DifficultyLevel,
  TimeSpan,
} from '../core/harmony-types.js';
import { CandidateLattice } from '../core/harmony-types.js';
import { ACCIDENTAL_OFFSET, NOTE_TO_SEMITONE } from '../core/constants.js';
import { DifficultyController } from '../harmonizer/difficulty-controller.js';
import { candidate_id } from './candidate-utils.js';
import { ModelRouter } from './model-router.js';
import { RetrievalRouter } from './retrieval-router.js';
import { RuleRouter } from './rule-router.js';
import type { CandidateRouterContext, KeyContext } from './types.js';
import { StyleControlSystem } from '../harmonizer/style-control-system.js';

interface CandidateLatticeGeneratorConfig {
  transition_probability_matrix?: Record<string, Record<string, number>>;
  difficulty_controller?: DifficultyController;
  rule_router?: RuleRouter;
  retrieval_router?: RetrievalRouter;
  model_router?: ModelRouter;
  style_controller?: StyleControlSystem;
}

export interface GenerateLatticeInput {
  score: CandidateRouterContext['score'];
  time_spans: TimeSpan[];
  key_sequence: KeyContext[];
  difficulty: DifficultyLevel;
  style: string;
  phrase_boundaries: TimeSpan[];
  functional_states?: string[];
}

function candidate_pc(candidate: ChordCandidate): number {
  return (NOTE_TO_SEMITONE[candidate.root] + ACCIDENTAL_OFFSET[candidate.root_accidental] + 12) % 12;
}

function is_phrase_ending(phraseBoundaries: TimeSpan[], span: TimeSpan): boolean {
  return phraseBoundaries.some((boundary) => Math.abs(boundary[1] - span[1]) < 0.25);
}

function progression_score(fromFn: string, toFn: string): number {
  const matrix: Record<string, Record<string, number>> = {
    tonic: { tonic: 0.45, subdominant: 0.75, dominant: 0.7 },
    subdominant: { dominant: 0.9, tonic: 0.35, subdominant: 0.4 },
    dominant: { tonic: 0.95, subdominant: 0.3, dominant: 0.4 },
    cadence_preparation: { dominant: 0.9, cadence_resolution: 0.85 },
    cadence_resolution: { tonic: 0.9, subdominant: 0.5 },
    transition: { tonic: 0.5, subdominant: 0.5, dominant: 0.5 },
  };

  return matrix[fromFn]?.[toFn] ?? 0.4;
}

function select_key_for_span(keySequence: KeyContext[], span: TimeSpan): KeyContext {
  const mid = (span[0] + span[1]) / 2;
  const exact = keySequence.find((key) => mid >= key.start_time && mid < key.end_time);
  if (exact) {
    return exact;
  }

  const fallback = keySequence
    .slice()
    .sort((a, b) => Math.abs(a.start_time - mid) - Math.abs(b.start_time - mid))[0];

  return fallback ?? {
    key: 'C',
    mode: 'major',
    confidence: 0.5,
    start_time: span[0],
    end_time: span[1],
  };
}

export class CandidateLatticeGenerator {
  private readonly transition_probability_matrix: Record<string, Record<string, number>>;
  private readonly difficulty_controller: DifficultyController;
  private readonly rule_router: RuleRouter;
  private readonly retrieval_router: RetrievalRouter;
  private readonly model_router: ModelRouter;
  private readonly style_controller: StyleControlSystem;

  constructor(config: CandidateLatticeGeneratorConfig = {}) {
    this.transition_probability_matrix = config.transition_probability_matrix ?? {};
    this.difficulty_controller = config.difficulty_controller ?? new DifficultyController();
    this.rule_router = config.rule_router ?? new RuleRouter();
    this.retrieval_router = config.retrieval_router ?? new RetrievalRouter();
    this.model_router = config.model_router ?? new ModelRouter();
    this.style_controller = config.style_controller ?? new StyleControlSystem();
  }

  async generate(input: GenerateLatticeInput): Promise<CandidateLattice> {
    const candidateRows: ChordCandidate[][] = [];

    for (let spanIndex = 0; spanIndex < input.time_spans.length; spanIndex++) {
      const timeSpan = input.time_spans[spanIndex];
      const keyContext = select_key_for_span(input.key_sequence, timeSpan);

      const context: CandidateRouterContext = {
        score: input.score,
        time_span: timeSpan,
        span_index: spanIndex,
        key_context: keyContext,
        difficulty: input.difficulty,
        style: input.style,
        phrase_boundaries: input.phrase_boundaries,
        functional_state: input.functional_states?.[spanIndex],
      };

      const [ruleCandidates, retrievalCandidates, modelCandidates] = await Promise.all([
        Promise.resolve(this.rule_router.generate(context)),
        this.retrieval_router.generate(context),
        this.model_router.generate(context),
      ]);

      const merged = [...ruleCandidates, ...retrievalCandidates, ...modelCandidates];

      const deduplicated = Array.from(
        merged.reduce((map, candidate) => {
          const id = candidate_id(candidate);
          const existing = map.get(id);
          if (!existing || candidate.confidence > existing.confidence) {
            map.set(id, candidate);
          }
          return map;
        }, new Map<string, ChordCandidate>()),
      ).map((entry) => entry[1]);

      const difficultyFiltered = this.difficulty_controller.filter(deduplicated, input.difficulty);
      const styleWeighted = this.style_controller.apply_style_weighting(
        input.style,
        difficultyFiltered.length > 0 ? difficultyFiltered : deduplicated.slice(0, 1),
      );
      candidateRows.push(styleWeighted);
    }

    const lattice = new CandidateLattice(input.time_spans, candidateRows);
    this.compute_transition_scores(lattice, input.phrase_boundaries, input.style);
    return lattice;
  }

  private compute_transition_scores(lattice: CandidateLattice, phraseBoundaries: TimeSpan[], style: string): void {
    for (let spanIndex = 0; spanIndex < lattice.time_spans.length - 1; spanIndex++) {
      const fromCandidates = lattice.get_candidates(spanIndex);
      const toCandidates = lattice.get_candidates(spanIndex + 1);
      const phraseEnding = is_phrase_ending(phraseBoundaries, lattice.time_spans[spanIndex + 1]);

      for (let fromIndex = 0; fromIndex < fromCandidates.length; fromIndex++) {
        for (let toIndex = 0; toIndex < toCandidates.length; toIndex++) {
          const fromCandidate = fromCandidates[fromIndex];
          const toCandidate = toCandidates[toIndex];

          const progression = progression_score(fromCandidate.function, toCandidate.function);
          const cadence = phraseEnding && (toCandidate.function === 'tonic' || toCandidate.function === 'dominant') ? 1 : 0.4;

          const bassDistance = Math.abs(candidate_pc(fromCandidate) - candidate_pc(toCandidate));
          const wrappedDistance = Math.min(bassDistance, 12 - bassDistance);
          const bassSmoothness = Math.max(0, 1 - wrappedDistance / 6);

          const historical = this.transition_probability_matrix[fromCandidate.roman_numeral]?.[toCandidate.roman_numeral] ?? 0.3;
          const styleTransition = this.style_controller.get_transition_probability(style, fromCandidate.roman_numeral, toCandidate.roman_numeral) ?? historical;
          const keyContinuity = fromCandidate.local_key === toCandidate.local_key ? 1 : 0.35;

          const score = (
            0.3 * progression +
            0.2 * cadence +
            0.2 * bassSmoothness +
            0.2 * (0.5 * historical + 0.5 * styleTransition) +
            0.1 * keyContinuity
          );

          const query: CandidateLatticeTransitionQuery = {
            from_span_index: spanIndex,
            from_candidate_index: fromIndex,
            to_span_index: spanIndex + 1,
            to_candidate_index: toIndex,
          };
          lattice.set_transition_score(query, score);
        }
      }
    }
  }
}
