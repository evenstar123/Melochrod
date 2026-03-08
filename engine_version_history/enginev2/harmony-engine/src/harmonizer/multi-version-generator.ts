import type { ChordCandidate, DifficultyLevel, TimeSpan } from '../core/harmony-types.js';
import type { Score } from '../core/types.js';
import type { KeyContext } from '../candidate/types.js';
import { CandidateLatticeGenerator } from '../candidate/candidate-lattice-generator.js';
import { GlobalDecoder } from '../decoder/global-decoder.js';
import { ThreeLayerRepairer } from '../repair/three-layer-repairer.js';
import { RepeatPhraseAnalyzer } from './repeat-phrase-analyzer.js';

export interface HarmonyVersion {
  name: string;
  description: string;
  applicable_scene: string;
  chord_sequence: ChordCandidate[];
  difficulty: DifficultyLevel;
  style: string;
  overall_confidence: number;
}

export interface MultiVersionInput {
  score: Score;
  key_sequence: KeyContext[];
  time_spans: TimeSpan[];
  phrase_boundaries: TimeSpan[];
}

export class MultiVersionGenerator {
  private readonly lattice_generator = new CandidateLatticeGenerator();
  private readonly decoder = new GlobalDecoder({ algorithm: 'viterbi' });
  private readonly repairer = new ThreeLayerRepairer();
  private readonly repeat_analyzer = new RepeatPhraseAnalyzer();

  async generate(input: MultiVersionInput): Promise<HarmonyVersion[]> {
    const configs: Array<{
      name: string;
      description: string;
      applicable_scene: string;
      difficulty: DifficultyLevel;
      style: string;
    }> = [
      {
        name: 'teaching-safe',
        description: 'Conservative and didactic harmonization with stable cadences.',
        applicable_scene: 'classroom teaching and beginner accompaniment',
        difficulty: 'basic',
        style: 'hymn',
      },
      {
        name: 'popular',
        description: 'Balanced pop progression with practical movement.',
        applicable_scene: 'songwriting demos and quick arrangement',
        difficulty: 'intermediate',
        style: 'pop',
      },
      {
        name: 'rich',
        description: 'Richer color tones and substitutions for advanced context.',
        applicable_scene: 'advanced arrangement and reharmonization study',
        difficulty: 'advanced',
        style: 'jazz-lite',
      },
    ];

    const versions: HarmonyVersion[] = [];

    for (const config of configs) {
      const lattice = await this.lattice_generator.generate({
        score: input.score,
        time_spans: input.time_spans,
        key_sequence: input.key_sequence,
        difficulty: config.difficulty,
        style: config.style,
        phrase_boundaries: input.phrase_boundaries,
      });

      const firstPass = this.decoder.decode(lattice, {
        key_sequence: input.key_sequence.map((key) => ({ key: key.key, start_time: key.start_time, end_time: key.end_time })),
        difficulty: config.difficulty,
        style: config.style,
        phrase_boundaries: input.phrase_boundaries,
      });

      const repeatGroups = this.repeat_analyzer.detect_repeats(input.score, input.phrase_boundaries, 0.85);
      const repeatExpectations = this.repeat_analyzer.build_repeat_expectations(
        firstPass.chord_sequence,
        input.time_spans,
        input.phrase_boundaries,
        repeatGroups,
      );

      const decoded = this.decoder.decode(lattice, {
        key_sequence: input.key_sequence.map((key) => ({ key: key.key, start_time: key.start_time, end_time: key.end_time })),
        difficulty: config.difficulty,
        style: config.style,
        phrase_boundaries: input.phrase_boundaries,
        repeat_expectations: repeatExpectations,
      });

      const repaired = this.repairer.repair(decoded.chord_sequence, lattice, input.phrase_boundaries);
      const overallConfidence = repaired.chord_sequence.length > 0
        ? repaired.chord_sequence.reduce((sum, chord) => sum + chord.confidence, 0) / repaired.chord_sequence.length
        : 0;

      versions.push({
        name: config.name,
        description: config.description,
        applicable_scene: config.applicable_scene,
        chord_sequence: repaired.chord_sequence,
        difficulty: config.difficulty,
        style: config.style,
        overall_confidence: overallConfidence,
      });
    }

    return versions;
  }
}
