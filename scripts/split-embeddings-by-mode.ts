/**
 * 按 mode 分片 embedding 数据
 *
 * 输入：phrase_meta.json + phrase_embeddings.bin
 * 输出：每个 mode 一组文件
 *   - phrase_meta_{mode}.json
 *   - phrase_embeddings_{mode}.bin
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../data');

const EMBEDDING_DIM = 1024;
const BYTES_PER_EMBEDDING = EMBEDDING_DIM * 4; // Float32

interface PhraseEntry {
  song_id: string;
  artist: string;
  song: string;
  mode: string;
  chord_sequence: string[];
  melody_intervals: number[];
}

function main() {
  console.log('Loading phrase_meta.json...');
  const phrases: PhraseEntry[] = JSON.parse(
    readFileSync(path.join(dataDir, 'phrase_meta.json'), 'utf-8')
  );

  console.log('Loading phrase_embeddings.bin...');
  const binBuf = readFileSync(path.join(dataDir, 'phrase_embeddings.bin'));
  const allEmbeddings = new Float32Array(
    binBuf.buffer, binBuf.byteOffset, binBuf.byteLength / 4
  );

  console.log(`Total: ${phrases.length} phrases, ${allEmbeddings.length} floats\n`);

  // Group indices by mode
  const modeIndices: Record<string, number[]> = {};
  for (let i = 0; i < phrases.length; i++) {
    const mode = phrases[i].mode;
    if (!modeIndices[mode]) modeIndices[mode] = [];
    modeIndices[mode].push(i);
  }

  // Write each mode shard
  for (const [mode, indices] of Object.entries(modeIndices)) {
    const count = indices.length;
    console.log(`[${mode}] ${count} phrases`);

    // Meta JSON
    const modePhrases = indices.map(i => phrases[i]);
    const metaPath = path.join(dataDir, `phrase_meta_${mode}.json`);
    writeFileSync(metaPath, JSON.stringify(modePhrases));
    const metaSize = (Buffer.byteLength(JSON.stringify(modePhrases)) / 1024 / 1024).toFixed(1);
    console.log(`  -> ${metaPath} (${metaSize} MB)`);

    // Binary embeddings
    const shardBuffer = Buffer.alloc(count * BYTES_PER_EMBEDDING);
    const shardView = new Float32Array(
      shardBuffer.buffer, shardBuffer.byteOffset, count * EMBEDDING_DIM
    );
    for (let j = 0; j < count; j++) {
      const srcOffset = indices[j] * EMBEDDING_DIM;
      const dstOffset = j * EMBEDDING_DIM;
      shardView.set(
        allEmbeddings.subarray(srcOffset, srcOffset + EMBEDDING_DIM),
        dstOffset
      );
    }
    const binPath = path.join(dataDir, `phrase_embeddings_${mode}.bin`);
    writeFileSync(binPath, shardBuffer);
    const binSize = (shardBuffer.byteLength / 1024 / 1024).toFixed(1);
    console.log(`  -> ${binPath} (${binSize} MB)`);
    console.log('');
  }

  console.log('Done! Shard summary:');
  let totalBin = 0;
  let totalMeta = 0;
  for (const [mode, indices] of Object.entries(modeIndices)) {
    const binMB = (indices.length * BYTES_PER_EMBEDDING) / 1024 / 1024;
    totalBin += binMB;
    totalMeta += indices.length * 0.00016; // rough estimate
    console.log(`  ${mode}: ${indices.length} phrases, bin ${binMB.toFixed(1)} MB`);
  }
  console.log(`\nLargest shard (major): ${((modeIndices['major']?.length ?? 0) * BYTES_PER_EMBEDDING / 1024 / 1024).toFixed(0)} MB`);
  console.log('This is the max memory needed at any time (vs 492 MB before)');
}

main();
