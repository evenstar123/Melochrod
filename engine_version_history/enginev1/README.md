# Engine V1 Archive

This folder contains the original v1 pipeline code, preserved as project history.

## Archived Files

| File | Original Location | Description |
|---|---|---|
| `harmonize-pipeline.ts` | `src/harmonizer/harmonize-pipeline.ts` | V1 端到端管线（线性 RAG→LLM→过滤） |
| `difficulty-filter.ts` | `src/harmonizer/difficulty-filter.ts` | V1 难度白名单过滤器 |
| `server-index.ts` | `server/index.ts` | 使用 v1 管线的服务器入口 |

## Archive Date

2026-03-09

## Reason

V2 架构升级完成后，API 层全面切换到 `HarmonyEnginePipeline`（候选网格→全局解码→三层修复→置信度校准），v1 线性管线（RAG→LLM→白名单过滤）不再使用。

## V1 vs V2

- **V1**: MusicXML → 解析 → RAG检索 → LLM生成 → 难度过滤 → 后处理验证
- **V2**: MusicXML → 增强解析 → 分析器层(5模块) → 候选网格(3路由) → 全局解码(Viterbi) → 三层修复 → 置信度校准 → MusicXML输出
