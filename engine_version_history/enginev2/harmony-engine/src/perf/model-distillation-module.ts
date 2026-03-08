export type DistillationMode = 'local-only' | 'hybrid' | 'llm-only';

export interface UserCorrectionRecord {
  previous_chord?: string;
  corrected_chord: string;
  context_signature?: string;
  weight?: number;
}

export interface LLMOutputRecord {
  previous_chord?: string;
  chord: string;
  context_signature?: string;
  confidence?: number;
}

export interface DistillationTrainingSample {
  previous_chord?: string;
  target_chord: string;
  source: 'user_correction' | 'llm_output';
  context_signature?: string;
  weight: number;
}

export interface DistillationValidationSample {
  previous_chord?: string;
  ground_truth_chord: string;
  llm_prediction?: string;
}

export interface DistillationEvaluationResult {
  total_samples: number;
  local_accuracy: number;
  llm_accuracy: number;
  quality_threshold_met: boolean;
}

export interface DistillationPrediction {
  chord: string;
  confidence: number;
}

export interface ModeSelectionResult {
  selected_chord: string | null;
  source: 'local' | 'llm' | 'none';
  confidence: number;
}

function map_key(previous: string | undefined, contextSignature?: string): string {
  return `${previous ?? '__START__'}|${contextSignature ?? '__GLOBAL__'}`;
}

export class ModelDistillationModule {
  private readonly transition_counts = new Map<string, Map<string, number>>();
  private readonly unigram_counts = new Map<string, number>();
  private mode: DistillationMode = 'hybrid';
  private trained_samples = 0;
  private readonly hybrid_local_threshold = 0.6;
  private readonly quality_margin_to_llm = 0.1;

  collect_training_data(
    user_corrections: UserCorrectionRecord[],
    llm_outputs: LLMOutputRecord[],
  ): DistillationTrainingSample[] {
    const fromCorrections = user_corrections.map((entry) => ({
      previous_chord: entry.previous_chord,
      target_chord: entry.corrected_chord,
      source: 'user_correction' as const,
      context_signature: entry.context_signature,
      weight: entry.weight ?? 1.5,
    }));

    const fromLlm = llm_outputs.map((entry) => ({
      previous_chord: entry.previous_chord,
      target_chord: entry.chord,
      source: 'llm_output' as const,
      context_signature: entry.context_signature,
      weight: entry.confidence ?? 1.0,
    }));

    return [...fromCorrections, ...fromLlm];
  }

  train(samples: DistillationTrainingSample[]): void {
    this.transition_counts.clear();
    this.unigram_counts.clear();
    this.trained_samples = 0;
    this.incremental_train(samples);
  }

  incremental_train(samples: DistillationTrainingSample[]): void {
    for (const sample of samples) {
      const key = map_key(sample.previous_chord, sample.context_signature);
      const row = this.transition_counts.get(key) ?? new Map<string, number>();
      row.set(sample.target_chord, (row.get(sample.target_chord) ?? 0) + sample.weight);
      this.transition_counts.set(key, row);
      this.unigram_counts.set(sample.target_chord, (this.unigram_counts.get(sample.target_chord) ?? 0) + sample.weight);
      this.trained_samples += 1;
    }
  }

  evaluate(
    validation_set: DistillationValidationSample[],
    llm_accuracy_baseline?: number,
  ): DistillationEvaluationResult {
    if (validation_set.length === 0) {
      return {
        total_samples: 0,
        local_accuracy: 0,
        llm_accuracy: llm_accuracy_baseline ?? 0,
        quality_threshold_met: false,
      };
    }

    let localCorrect = 0;
    let llmCorrect = 0;
    let llmCount = 0;

    for (const sample of validation_set) {
      const local = this.predict(sample.previous_chord);
      if (local?.chord === sample.ground_truth_chord) {
        localCorrect += 1;
      }

      if (sample.llm_prediction) {
        llmCount += 1;
        if (sample.llm_prediction === sample.ground_truth_chord) {
          llmCorrect += 1;
        }
      }
    }

    const localAccuracy = localCorrect / validation_set.length;
    const llmAccuracy = llm_accuracy_baseline ?? (llmCount === 0 ? 0 : llmCorrect / llmCount);
    const qualityThresholdMet = localAccuracy >= Math.max(0.5, llmAccuracy - this.quality_margin_to_llm);

    return {
      total_samples: validation_set.length,
      local_accuracy: localAccuracy,
      llm_accuracy: llmAccuracy,
      quality_threshold_met: qualityThresholdMet,
    };
  }

  predict(previous_chord?: string, context_signature?: string): DistillationPrediction | null {
    const contextual = this.best_from_row(map_key(previous_chord, context_signature));
    if (contextual) {
      return contextual;
    }

    const global = this.best_from_row(map_key(previous_chord, undefined));
    if (global) {
      return global;
    }

    const fallback = this.best_unigram();
    return fallback;
  }

  set_mode(mode: DistillationMode): void {
    this.mode = mode;
  }

  get_mode(): DistillationMode {
    return this.mode;
  }

  select_mode_prediction(input: {
    previous_chord?: string;
    context_signature?: string;
    llm_prediction?: string;
  }): ModeSelectionResult {
    const local = this.predict(input.previous_chord, input.context_signature);

    if (this.mode === 'local-only') {
      if (!local) {
        return { selected_chord: null, source: 'none', confidence: 0 };
      }
      return { selected_chord: local.chord, source: 'local', confidence: local.confidence };
    }

    if (this.mode === 'llm-only') {
      if (!input.llm_prediction) {
        return { selected_chord: null, source: 'none', confidence: 0 };
      }
      return { selected_chord: input.llm_prediction, source: 'llm', confidence: 0.7 };
    }

    if (local && local.confidence >= this.hybrid_local_threshold) {
      return { selected_chord: local.chord, source: 'local', confidence: local.confidence };
    }
    if (input.llm_prediction) {
      return { selected_chord: input.llm_prediction, source: 'llm', confidence: 0.7 };
    }
    if (local) {
      return { selected_chord: local.chord, source: 'local', confidence: local.confidence };
    }
    return { selected_chord: null, source: 'none', confidence: 0 };
  }

  get_stats(): { trained_samples: number; unique_chords: number } {
    return {
      trained_samples: this.trained_samples,
      unique_chords: this.unigram_counts.size,
    };
  }

  private best_from_row(key: string): DistillationPrediction | null {
    const row = this.transition_counts.get(key);
    if (!row || row.size === 0) {
      return null;
    }

    let bestChord = '';
    let bestWeight = Number.NEGATIVE_INFINITY;
    let totalWeight = 0;
    for (const [chord, weight] of row.entries()) {
      totalWeight += weight;
      if (weight > bestWeight) {
        bestWeight = weight;
        bestChord = chord;
      }
    }

    return {
      chord: bestChord,
      confidence: totalWeight <= 0 ? 0 : bestWeight / totalWeight,
    };
  }

  private best_unigram(): DistillationPrediction | null {
    if (this.unigram_counts.size === 0) {
      return null;
    }

    let bestChord = '';
    let bestWeight = Number.NEGATIVE_INFINITY;
    let totalWeight = 0;
    for (const [chord, weight] of this.unigram_counts.entries()) {
      totalWeight += weight;
      if (weight > bestWeight) {
        bestWeight = weight;
        bestChord = chord;
      }
    }

    return {
      chord: bestChord,
      confidence: totalWeight <= 0 ? 0 : bestWeight / totalWeight,
    };
  }
}

