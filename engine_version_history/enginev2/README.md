# enginev2 Archive

最后更新：2026-03-09

这个目录用于归档 `v2` 研发阶段的代码与设计资料，原因不是版本正常演进，而是：

1. `v2` 在真实编配效果上明显劣于 `v1`
2. `v2` 不再承担生产主链路职责
3. 后续如需讨论 `v3`，必须先以 `v1` 为效果基线重新建立评测体系

## 归档内容

- `harmony-engine/src/` 下的 v2 架构模块
- `harmony-engine/tests/` 下的 v2 测试
- `.kiro/specs/harmony-engine-architecture-upgrade/` 原始规格文档

## 目录说明

- `harmony-engine/src/analyzer/`：v2 分析层
- `harmony-engine/src/candidate/`：候选网格生成
- `harmony-engine/src/decoder/`：全局解码
- `harmony-engine/src/repair/`：三层修复
- `harmony-engine/src/harmonizer/harmony-engine-pipeline.ts`：v2 主管线
- `specs/harmony-engine-architecture-upgrade/`：v2 架构设计与任务拆解

## 现状

当前生产代码不再从这里导入任何模块。  
如果未来需要复盘、对照、拆模块做研究，只能以旁路实验方式引用，不允许直接恢复为主引擎。
