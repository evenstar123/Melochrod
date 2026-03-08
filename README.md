# MeloChord Harmony Engine

当前生产基线是 `v1` 管线：

- `MusicXML -> 解析 -> 调性分析 -> 旋律特征 -> RAG -> LLM -> 难度过滤 -> 验证 -> 回写 MusicXML`
- 服务端保留了现有 Web / App / 小程序依赖的 API 形状与流式进度接口
- `v2` 架构代码、测试和设计规格已归档到 [`engine_version_history/enginev2`](./engine_version_history/enginev2)

## 当前状态

- 生产入口：`server/index.ts`
- 主引擎：`src/harmonizer/harmonize-pipeline.ts`
- 健康检查：`GET /api/health`，返回 `engine: "v1"`
- 和声接口：`POST /api/harmonize`
- OMR 一站式接口：`POST /api/omr/harmonize`

## 快速开始

```bash
npm install
```

在 `harmony-engine/.env.local` 中配置：

```env
DASHSCOPE_API_KEY=your_api_key_here
AUDIVERIS_PATH=optional
```

启动开发服务器：

```bash
npm run dev
```

访问 `http://localhost:4000`

## 数据文件

以下文件通常不进仓库，需要单独准备：

- `data/hooktheory_phrases.json`
- `data/phrase_meta.json`
- `data/phrase_embeddings.bin`

如果需要重新生成 embedding：

```bash
npx tsx scripts/precompute-embeddings.ts
npx tsx scripts/convert-embeddings-to-bin.ts
```

## 架构说明

`v1` 是当前唯一生产路线。原因不是“兼容保留”，而是它在真实编配效果上显著优于 `v2`。

`v2` 已退出主链路。相关复盘见：

- [`doc/v2引擎研发失败.md`](./doc/v2引擎研发失败.md)
- [`engine_version_history/enginev2/README.md`](./engine_version_history/enginev2/README.md)
