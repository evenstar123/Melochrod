import { describe, expect, it } from 'vitest';
import { ModelDistillationModule } from '../src/perf/model-distillation-module.js';

describe('ModelDistillationModule', () => {
  it('trains a local symbolic model from correction and llm data', () => {
    const module = new ModelDistillationModule();
    const samples = module.collect_training_data(
      [
        { previous_chord: 'I', corrected_chord: 'V' },
        { previous_chord: 'I', corrected_chord: 'V' },
      ],
      [
        { previous_chord: 'I', chord: 'IV', confidence: 0.4 },
      ],
    );
    module.train(samples);

    const prediction = module.predict('I');
    expect(prediction?.chord).toBe('V');
    expect((prediction?.confidence ?? 0)).toBeGreaterThan(0.5);
  });

  it('evaluates distilled model quality', () => {
    const module = new ModelDistillationModule();
    module.train([
      { previous_chord: 'I', target_chord: 'V', source: 'user_correction', weight: 2 },
      { previous_chord: 'V', target_chord: 'I', source: 'user_correction', weight: 2 },
    ]);

    const evaluation = module.evaluate([
      { previous_chord: 'I', ground_truth_chord: 'V', llm_prediction: 'IV' },
      { previous_chord: 'V', ground_truth_chord: 'I', llm_prediction: 'I' },
    ]);

    expect(evaluation.total_samples).toBe(2);
    expect(evaluation.local_accuracy).toBeGreaterThanOrEqual(0.5);
    expect(evaluation.quality_threshold_met).toBe(true);
  });

  it('supports local-only, hybrid and llm-only mode selection', () => {
    const module = new ModelDistillationModule();
    module.train([
      { previous_chord: 'I', target_chord: 'V', source: 'user_correction', weight: 3 },
    ]);

    module.set_mode('local-only');
    const local = module.select_mode_prediction({ previous_chord: 'I', llm_prediction: 'IV' });
    expect(local.source).toBe('local');
    expect(local.selected_chord).toBe('V');

    module.set_mode('llm-only');
    const llm = module.select_mode_prediction({ previous_chord: 'I', llm_prediction: 'IV' });
    expect(llm.source).toBe('llm');
    expect(llm.selected_chord).toBe('IV');

    module.set_mode('hybrid');
    const hybrid = module.select_mode_prediction({ previous_chord: 'I', llm_prediction: 'IV' });
    expect(['local', 'llm']).toContain(hybrid.source);
  });
});

