import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['engine_version_history/**', 'dist/**', 'coverage/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/core/types.ts',
        'src/harmonizer/harmonize-pipeline.ts',
        'src/harmonizer/rag-retriever.ts',
        'src/harmonizer/semantic-features.ts',
        'src/converter/abc-to-musicxml.ts',
        'src/converter/ir-to-abc.ts',
        'src/converter/ir-to-render.ts',
        'src/candidate/types.ts',
        'src/parser/musicxml-merge.ts',
        'src/omr/audiveris-omr.ts',
        'src/omr/mxl-unzip.ts',
      ],
    },
  },
});
