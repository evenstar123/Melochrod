import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { HarmonizePipeline, type PipelineConfig, type PipelineResult } from '../src/harmonizer/harmonize-pipeline.js';
import { injectChordsToMusicXML } from '../src/converter/ir-to-musicxml.js';
import { scoreToABC } from '../src/converter/ir-to-abc.js';
import { musicxmlToPNG, musicxmlToPDF } from '../src/converter/score-to-render.js';
import { recognizeBuffer } from '../src/omr/audiveris-omr.js';
import { mergeMusicXMLPages } from '../src/parser/musicxml-merge.js';
import type { ChordSymbol } from '../src/core/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../.env.local'), quiet: true });

const app = express();

const PORT = Number(process.env.PORT) || 4000;
const STATIC_DIR = path.resolve(__dirname, '../web');
const PHRASES_PATH = path.resolve(__dirname, '../data/hooktheory_phrases.json');
const VALID_DIFFICULTIES = ['basic', 'intermediate', 'advanced'] as const;
type DifficultyLevel = typeof VALID_DIFFICULTIES[number];

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const uploadMulti = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 50 } });

app.use(express.static(STATIC_DIR));

const QUALITY_SUFFIX: Record<string, string> = {
  major: '',
  minor: 'm',
  diminished: 'dim',
  augmented: 'aug',
  dominant7: '7',
  major7: 'maj7',
  minor7: 'm7',
  diminished7: 'dim7',
  'half-dim7': 'm7b5',
  sus2: 'sus2',
  sus4: 'sus4',
};

const ACC_SYMBOL: Record<string, string> = {
  sharp: '#',
  flat: 'b',
  none: '',
  natural: '',
  'double-sharp': '##',
  'double-flat': 'bb',
};

const ALLOWED_OMR_EXTS = ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'pdf'];

function formatChordName(chord: ChordSymbol): string {
  return `${chord.root}${ACC_SYMBOL[chord.rootAccidental] ?? ''}${QUALITY_SUFFIX[chord.quality] ?? ''}`;
}

function sendSSE(res: express.Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function initSSE(res: express.Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

function isStreamRequest(req: express.Request): boolean {
  return req.query.stream === 'true' || req.body?.stream === true;
}

function validateDifficulty(value: unknown): value is DifficultyLevel {
  return typeof value === 'string' && VALID_DIFFICULTIES.includes(value as DifficultyLevel);
}

function requireApiKey(): string {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('服务器缺少 DASHSCOPE_API_KEY 配置');
  }
  return apiKey;
}

function createPipeline(difficulty: DifficultyLevel): HarmonizePipeline {
  const config: PipelineConfig = {
    apiKey: requireApiKey(),
    phrasesPath: PHRASES_PATH,
    difficulty,
  };
  return new HarmonizePipeline(config);
}

function formatPipelineResponse(result: PipelineResult, originalMusicxml: string, extraStats: Record<string, number> = {}) {
  const injectStart = Date.now();
  const enrichedMusicxml = injectChordsToMusicXML(originalMusicxml, result.score);
  const chordInjectionMs = Date.now() - injectStart;

  const chordProgression: string[] = [];
  for (const measure of result.score.measures) {
    for (const chord of measure.chords) {
      chordProgression.push(formatChordName(chord));
    }
  }

  return {
    score: result.score,
    musicxml: enrichedMusicxml,
    analysis: {
      key: result.keyAnalysis.key,
      confidence: result.keyAnalysis.confidence,
      source: result.keyAnalysis.source,
      chordProgression,
      stats: {
        totalMeasures: result.score.measures.length,
        totalChords: chordProgression.length,
        apiCalls: result.stats.apiCalls,
        durationMs: result.stats.durationMs,
        totalMs: result.stats.durationMs,
        chordInjectionMs,
        stageTiming: result.stats.stageTiming,
        ...extraStats,
      },
    },
  };
}

function ensureOmrFile(req: express.Request, res: express.Response): Express.Multer.File | null {
  if (!req.file) {
    res.status(400).json({ error: '缺少 file 字段' });
    return null;
  }

  const ext = req.file.originalname.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_OMR_EXTS.includes(ext)) {
    res.status(400).json({ error: `不支持的文件格式: ${ext}` });
    return null;
  }

  return req.file;
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    engine: 'v1',
    uptime: process.uptime(),
    memory: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
    dashscope: !!process.env.DASHSCOPE_API_KEY,
  });
});

app.post('/api/harmonize', async (req, res) => {
  const { musicxml, difficulty } = req.body;

  if (!musicxml) {
    return res.status(400).json({ error: '缺少 musicxml 参数' });
  }
  if (!validateDifficulty(difficulty)) {
    return res.status(400).json({ error: '无效的难度级别' });
  }

  const isStream = isStreamRequest(req);

  try {
    if (isStream) {
      initSSE(res);
      sendSSE(res, { type: 'progress', stage: 'PARSER', message: '正在加载乐谱并准备 v1 编配管线...', current: 1, total: 3 });
    }

    const pipeline = createPipeline(difficulty);

    if (isStream) {
      sendSSE(res, { type: 'progress', stage: 'KEY', message: '正在执行 v1 主引擎编配...', current: 2, total: 3 });
    }

    const result = await pipeline.harmonizeFromXML(musicxml);

    if (isStream) {
      sendSSE(res, { type: 'progress', stage: 'OUTPUT', message: '正在整理结果并回写和弦标注...', current: 3, total: 3 });
    }

    const response = formatPipelineResponse(result, musicxml);

    if (isStream) {
      sendSSE(res, { type: 'complete', ...response });
      res.end();
      return;
    }

    return res.json(response);
  } catch (err: any) {
    console.error('[/api/harmonize] v1 pipeline error:', err);
    if (isStream) {
      sendSSE(res, { type: 'error', message: err.message ?? String(err) });
      res.end();
      return;
    }
    return res.status(500).json({ error: `和声分析失败: ${err.message ?? err}` });
  }
});

app.post('/api/export/abc', (req, res) => {
  const { score } = req.body;
  if (!score) {
    return res.status(400).json({ error: '缺少 score 参数' });
  }

  try {
    const abc = scoreToABC(score);
    return res.json({ abc });
  } catch (err: any) {
    console.error('[/api/export/abc] conversion error:', err);
    return res.status(500).json({ error: `ABC 转换失败: ${err.message ?? err}` });
  }
});

app.post('/api/export/png', async (req, res) => {
  const { score, musicxml } = req.body;
  if (!musicxml) {
    return res.status(400).json({ error: '缺少 musicxml 参数' });
  }

  try {
    const finalXml = score ? injectChordsToMusicXML(musicxml, score) : musicxml;
    const pngBuf = await musicxmlToPNG(finalXml);
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', 'attachment; filename="score.png"');
    return res.send(pngBuf);
  } catch (err: any) {
    console.error('[/api/export/png] error:', err);
    return res.status(500).json({ error: `PNG 导出失败: ${err.message ?? err}` });
  }
});

app.post('/api/export/pdf', async (req, res) => {
  const { score, musicxml } = req.body;
  if (!musicxml) {
    return res.status(400).json({ error: '缺少 musicxml 参数' });
  }

  try {
    const finalXml = score ? injectChordsToMusicXML(musicxml, score) : musicxml;
    const pdfBuf = await musicxmlToPDF(finalXml);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="score.pdf"');
    return res.send(pdfBuf);
  } catch (err: any) {
    console.error('[/api/export/pdf] error:', err);
    return res.status(500).json({ error: `PDF 导出失败: ${err.message ?? err}` });
  }
});

app.post('/api/omr', upload.single('file'), async (req, res) => {
  const file = ensureOmrFile(req, res);
  if (!file) return;

  try {
    const result = await recognizeBuffer(
      file.buffer,
      file.originalname,
      { audiverisPath: process.env.AUDIVERIS_PATH },
    );
    return res.json({ musicxml: result.musicxml });
  } catch (err: any) {
    console.error('[/api/omr] error:', err);
    return res.status(500).json({ error: `OMR 识别失败: ${err.message ?? err}` });
  }
});

app.post('/api/omr/harmonize', upload.single('file'), async (req, res) => {
  const file = ensureOmrFile(req, res);
  if (!file) return;

  const difficulty = String(req.query.difficulty || req.body?.difficulty || 'basic');
  if (!validateDifficulty(difficulty)) {
    return res.status(400).json({ error: '无效的难度级别' });
  }

  const isStream = isStreamRequest(req);

  try {
    if (isStream) {
      initSSE(res);
      sendSSE(res, { type: 'progress', stage: 'OMR', message: '正在识别乐谱图像...', current: 1, total: 4 });
    }

    const omrResult = await recognizeBuffer(
      file.buffer,
      file.originalname,
      { audiverisPath: process.env.AUDIVERIS_PATH },
    );

    if (isStream) {
      sendSSE(res, { type: 'progress', stage: 'PARSER', message: '乐谱识别完成，准备进入 v1 编配管线...', current: 2, total: 4 });
    }

    const pipeline = createPipeline(difficulty);

    if (isStream) {
      sendSSE(res, { type: 'progress', stage: 'KEY', message: '正在执行 v1 主引擎编配...', current: 3, total: 4 });
    }

    const result = await pipeline.harmonizeFromXML(omrResult.musicxml);

    if (isStream) {
      sendSSE(res, { type: 'progress', stage: 'OUTPUT', message: '正在生成最终带和弦的乐谱...', current: 4, total: 4 });
    }

    const response = formatPipelineResponse(result, omrResult.musicxml);

    if (isStream) {
      sendSSE(res, { type: 'complete', ...response });
      res.end();
      return;
    }

    return res.json(response);
  } catch (err: any) {
    console.error('[/api/omr/harmonize] error:', err);
    if (isStream) {
      sendSSE(res, { type: 'error', message: err.message ?? String(err) });
      res.end();
      return;
    }
    return res.status(500).json({ error: `处理失败: ${err.message ?? err}` });
  }
});

app.post('/api/omr/pages', uploadMulti.array('files', 50), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: '缺少 files 字段' });
  }

  for (const file of files) {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_OMR_EXTS.includes(ext)) {
      return res.status(400).json({ error: `不支持的文件格式: ${ext} (${file.originalname})` });
    }
  }

  try {
    const pageResults: { pageIndex: number; musicxml: string; filename: string }[] = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const result = await recognizeBuffer(
        file.buffer,
        file.originalname,
        { audiverisPath: process.env.AUDIVERIS_PATH },
      );
      pageResults.push({ pageIndex: i, musicxml: result.musicxml, filename: file.originalname });
    }

    const mergedXml = mergeMusicXMLPages(pageResults.map(page => page.musicxml));
    return res.json({ pages: pageResults, merged: mergedXml, totalPages: files.length });
  } catch (err: any) {
    console.error('[/api/omr/pages] error:', err);
    return res.status(500).json({ error: `多页 OMR 识别失败: ${err.message ?? err}` });
  }
});

app.post('/api/omr/pages/harmonize', uploadMulti.array('files', 50), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: '缺少 files 字段' });
  }

  for (const file of files) {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_OMR_EXTS.includes(ext)) {
      return res.status(400).json({ error: `不支持的文件格式: ${ext} (${file.originalname})` });
    }
  }

  const difficulty = String(req.query.difficulty || req.body?.difficulty || 'basic');
  if (!validateDifficulty(difficulty)) {
    return res.status(400).json({ error: '无效的难度级别' });
  }

  try {
    const pageXmls: string[] = [];
    for (const file of files) {
      const result = await recognizeBuffer(
        file.buffer,
        file.originalname,
        { audiverisPath: process.env.AUDIVERIS_PATH },
      );
      pageXmls.push(result.musicxml);
    }

    const mergedXml = mergeMusicXMLPages(pageXmls);
    const pipeline = createPipeline(difficulty);
    const result = await pipeline.harmonizeFromXML(mergedXml);
    const response = formatPipelineResponse(result, mergedXml);

    let measureOffset = 0;
    const pageRanges: { pageIndex: number; startMeasure: number; endMeasure: number }[] = [];
    for (let i = 0; i < pageXmls.length; i += 1) {
      const pageMeasureCount = pageXmls[i].match(/<measure\b/g)?.length ?? 0;
      pageRanges.push({
        pageIndex: i,
        startMeasure: measureOffset + 1,
        endMeasure: measureOffset + pageMeasureCount,
      });
      measureOffset += pageMeasureCount;
    }

    return res.json({
      ...response,
      pagination: {
        totalPages: files.length,
        pageRanges,
        totalMeasures: measureOffset,
      },
    });
  } catch (err: any) {
    console.error('[/api/omr/pages/harmonize] error:', err);
    return res.status(500).json({ error: `多页处理失败: ${err.message ?? err}` });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('  MeloChord Harmony Engine v1');
  console.log(`  Listening on http://0.0.0.0:${PORT}`);
  console.log(`  Static files: ${STATIC_DIR}`);
  console.log(`  DASHSCOPE_API_KEY: ${process.env.DASHSCOPE_API_KEY ? 'configured' : 'missing'}`);
  console.log(`  AUDIVERIS_PATH: ${process.env.AUDIVERIS_PATH || '(auto-detect)'}`);
  console.log('========================================');
});

export { app, PORT, STATIC_DIR };
