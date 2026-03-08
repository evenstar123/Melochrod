# Web Frontend Implementation Tasks

## Overview

Web 端使用 **TypeScript + React** 实现三栏深度工作台，覆盖 requirements 31-46。

**Programming Language**: TypeScript
**Framework**: React (Vite)
**Total Requirements**: 16 (Requirements 31-46)
**Design Context**: `design.md` 前端章节（三栏布局、视觉系统、交互流程）
**Contract Context**:
- `harmony-engine/src/index.ts`（前端可依赖的公共导出）
- `harmony-engine/server/index.ts`（当前已实现 REST 端点）
- `harmony-engine/src/core/types.ts`（Score/Measure/Note 等核心结构）
- `harmony-engine/src/core/harmony-types.ts`（ChordCandidate/CandidateLattice 等新架构类型）
- 可选增强：`HarmonyEnginePipelineResult`、`Explanation`

> 注意：当前 `server/index.ts` 已实现的端点主要是 harmonize/omr/export；项目库、课堂、协作类端点尚未落地。
> Web 任务需提供“可切换 Mock/真实 API”的适配层，保证前端可并行开发。

---

## 1. Project Setup and Workspace Architecture

- [x] 1.1 初始化 React + TypeScript 工程
  - 使用 Vite 创建 `melochord-web`（或等效前端目录）
  - 开启 TypeScript strict 模式
  - 建立目录：`src/app`、`src/pages`、`src/features`、`src/components`、`src/services`、`src/store`、`src/types`
  - _Requirements: 31_

- [x] 1.2 建立工程规范
  - 配置 ESLint + Prettier
  - 配置路径别名（`@/`）
  - 配置环境变量分层：`.env.development`、`.env.production`
  - _Requirements: 31_

- [x] 1.3 安装核心依赖
  - 路由：React Router
  - 状态：Zustand（或 Redux Toolkit）
  - 数据请求：Axios + TanStack Query
  - 乐谱渲染：OpenSheetMusicDisplay / VexFlow（二选一主渲染，另一作为降级）
  - _Requirements: 31_

- [x]* 1.4 配置测试基线
  - Vitest + React Testing Library
  - Playwright（关键流程 E2E）
  - _Requirements: 31_

## 2. Contract-First Type System

- [x] 2.1 建立后端类型镜像层（前端类型适配）
  - 对齐 `src/core/types.ts`：`Score`、`Measure`、`MusicEvent`、`Note`、`Rest`、`ChordSymbol`
  - 对齐 `src/core/harmony-types.ts`：`ChordCandidate`、`CandidateLattice`、`DifficultyLevel`
  - _Requirements: 31, 36_

- [x] 2.2 建立 API DTO 与 Domain Model 分层
  - `api/*.ts`：原始响应类型
  - `domain/*.ts`：UI 使用模型
  - 实现转换器：`dtoToDomain`、`domainToRequest`
  - _Requirements: 31, 40_

- [x] 2.3 兼容新架构增强字段
  - 对接 `HarmonyEnginePipelineResult`（`confidence`、`explanations`、`lattice`、`monitoring`）
  - 对接 `Explanation`（`one_liner`、`standard`、`deep`、`alternatives`）
  - _Requirements: 44, 45_

- [x]* 2.4 类型契约测试
  - 基于样例响应做 schema 校验
  - 防止字段缺失导致 UI 崩溃
  - _Requirements: 31_

## 3. API Integration and Capability Matrix

- [x] 3.1 实现当前可用端点客户端（按 `server/index.ts`）
  - `GET /api/health`
  - `POST /api/harmonize`
  - `POST /api/omr`
  - `POST /api/omr/harmonize`
  - `POST /api/omr/pages`
  - `POST /api/omr/pages/harmonize`
  - `POST /api/export/abc`、`/api/export/png`、`/api/export/pdf`
  - _Requirements: 35, 36, 46_

- [x] 3.2 构建能力检测与降级策略
  - 启动时探测服务可用能力（health + feature flags）
  - 对未实现端点显示占位态与 Mock 数据
  - 保证页面在“部分后端可用”时可运行
  - _Requirements: 31, 42_

- [x] 3.3 为规划中端点预留 Adapter
  - `projects/classes/edit/sync` 等接口先定义协议与 Mock 实现
  - 后端就绪后可无痛切换
  - _Requirements: 38, 39, 43_

- [x]* 3.4 API 错误处理与重试测试
  - 网络超时/500/字段不完整
  - _Requirements: 42_

## 4. Visual System and Design Tokens

- [x] 4.1 实现设计令牌
  - 色彩、间距、圆角、阴影、层级、动效时长
  - 难度色（basic/intermediate/advanced）与置信度色（高/中/低）
  - _Requirements: 33, 45_

- [x] 4.2 实现字体系统
  - UI 文本字体 + 数字/节奏等宽字体
  - 标题、正文、注释三级排版规范
  - _Requirements: 33_

- [x] 4.3 实现动效规范
  - 面板展开/收起
  - 版本切换与候选替换过渡
  - 进度阶段流转动效
  - _Requirements: 33, 42_

## 5. Three-Column Layout and Responsive Rules

- [x] 5.1 实现三栏主框架
  - 左栏：导航/项目结构
  - 中栏：乐谱舞台
  - 右栏：候选、解释、操作面板
  - _Requirements: 31_

- [x] 5.2 响应式断点实现
  - >=1440: 三栏完整
  - 1024-1439: 右栏可折叠
  - 768-1023: 左栏收缩为图标导航
  - <768: 轻量浏览模式
  - _Requirements: 31_

- [x] 5.3 栏宽拖拽与状态记忆
  - 支持拖拽分栏
  - 本地持久化栏宽、折叠状态
  - _Requirements: 31_

## 6. Navigation and Command System

- [x] 6.1 实现主导航结构
  - 工作台、项目库、课堂协作、模板风格、资源中心、设置
  - 支持激活态与通知徽标
  - _Requirements: 32_

- [x] 6.2 实现键盘快捷键
  - `Cmd/Ctrl + 1..6` 切换主导航
  - `Cmd/Ctrl + Z/Y` 撤销重做
  - `Space` 播放/暂停
  - _Requirements: 32_

- [x] 6.3 移动端导航回退方案
  - 小屏幕下折叠为 Drawer
  - _Requirements: 32_

## 7. Core Reusable Components

- [x] 7.1 `ChordCapsule`
  - 显示和弦名、Roman numeral、难度标签、置信度状态
  - 支持用户修改标识
  - _Requirements: 40_

- [x] 7.2 `MeasureHeatStrip`
  - 时间轴显示每小节置信度
  - 叠加 OMR 风险、转调点、异常点
  - _Requirements: 40, 45_

- [x] 7.3 `AIShelf`
  - 显示候选和弦卡片（来源、理由、应用/对比）
  - 支持音频预听触发
  - _Requirements: 40_

- [x] 7.4 `WhyCard`
  - 展示解释三层深度（一句话/标准/深入）
  - 展示 melody-chord 关系与替代方案
  - _Requirements: 40, 44_

- [x] 7.5 `VersionLens`
  - 多版本并排比较（A/B）
  - 差异高亮
  - _Requirements: 40, 43_

- [x]* 7.6 组件单测
  - 覆盖渲染、交互与无障碍属性
  - _Requirements: 40_

## 8. Home Page (Requirement 34)

- [x] 8.1 Hero 区域
  - 继续上次项目、快速上传、体验示例
  - _Requirements: 34_

- [x] 8.2 项目分组视图
  - 待确认、已完成、课堂中、收藏模板
  - _Requirements: 34_

- [x] 8.3 全局搜索入口
  - 支持标题/调性/和弦/教师备注/学生名
  - _Requirements: 34_

- [x]* 8.4 首页测试
  - _Requirements: 34_

## 9. Import Hub (Requirement 35)

- [x] 9.1 上传与格式识别
  - 单文件/批量拖拽上传
  - 支持 PDF/PNG/JPG/MusicXML
  - _Requirements: 35_

- [x] 9.2 OMR 与一站式分析流程
  - 仅 OMR：`/api/omr`、`/api/omr/pages`
  - OMR+和声：`/api/omr/harmonize`、`/api/omr/pages/harmonize`
  - _Requirements: 35, 36_

- [x] 9.3 质量提示与预处理建议
  - 低清晰度风险提示
  - 页序调整后再提交
  - _Requirements: 35_

- [x]* 9.4 导入流程测试
  - _Requirements: 35_

## 10. Analysis Workbench (Requirement 36)

- [x] 10.1 视图切换
  - 领谱/五线谱/简谱/功能和声/对比视图
  - 右栏内容随视图联动
  - _Requirements: 36_

- [x] 10.2 乐谱渲染与导航
  - 缩放、滚动、当前小节高亮
  - 多页乐谱分页导航（与 `/api/omr/pages/harmonize` 返回对齐）
  - _Requirements: 36_

- [x] 10.3 双层时间轴
  - 调性轨、和声节奏轨、低置信热区轨
  - _Requirements: 36, 45_

- [x] 10.4 区域选择与浮动工具条
  - 选择 1-8 小节
  - 提供局部重算、难度调整、风格变化、查看替代方案
  - _Requirements: 36, 43_

- [x] 10.5 版本树与撤销重做
  - 始终可见 Undo/Redo
  - 自动保存版本节点
  - _Requirements: 36, 43_

- [x]* 10.6 工作台测试
  - _Requirements: 36_

## 11. Review Mode (Requirement 37)

- [x] 11.1 审核布局
  - 中部当前小节+上下文
  - 右侧 top-3 候选
  - 底部理由区（覆盖率、功能、转调、相似片段）
  - _Requirements: 37_

- [x] 11.2 自动跳转与进度
  - 默认跳至低置信度小节
  - “下一个待确认”键位支持
  - _Requirements: 37_

- [x] 11.3 稍后处理清单
  - 支持跳过并加入稍后处理
  - _Requirements: 37_

- [x]* 11.4 审核模式测试
  - _Requirements: 37_

## 12. Project Library (Requirement 38)

- [x] 12.1 项目卡片与元数据
  - 状态、更新时间、导出记录、标签
  - _Requirements: 38_

- [x] 12.2 筛选排序与批量操作
  - 按状态/难度/风格/调性筛选
  - 批量导出、归档、删除
  - _Requirements: 38_

- [x] 12.3 后端未就绪场景
  - 先接 Mock repository
  - 标注待接入真实端点
  - _Requirements: 38_

- [x]* 12.4 项目库测试
  - _Requirements: 38_

## 13. Classroom Hub (Requirement 39)

- [x] 13.1 班级与作业基础流程
  - 班级管理、作业创建、提交列表
  - _Requirements: 39_

- [x] 13.2 批注与评分视图
  - 乐谱定位批注、评分维度、模板反馈
  - _Requirements: 39_

- [x] 13.3 学生端结果回看
  - 查看反馈、查看版本差异、进度曲线
  - _Requirements: 39_

- [x] 13.4 后端占位策略
  - 课堂接口未就绪时启用 Mock + feature flag
  - _Requirements: 39_

- [x]* 13.5 课堂流程测试
  - _Requirements: 39_

## 14. Onboarding Flow (Requirement 41)

- [x] 14.1 游客试用
  - 免注册体验示例或单页上传
  - _Requirements: 41_

- [x] 14.2 角色选择
  - 教师/学习者/创作者
  - 仅影响默认推荐，不锁功能
  - _Requirements: 41_

- [x] 14.3 首次成功引导
  - 用“就地提示”替代冗长教程
  - _Requirements: 41_

- [x]* 14.4 新手流程测试
  - _Requirements: 41_

## 15. Progress Feedback (Requirement 42)

- [x] 15.1 阶段化进度展示
  - 上传、识谱、旋律分析、调性分析、和声生成、验证、完成
  - _Requirements: 42_

- [x] 15.2 风险警告可读化
  - 对 OMR 风险、低置信区段给出明确提示语
  - _Requirements: 42_

- [x] 15.3 可取消与恢复
  - 长任务取消
  - 重新进入时恢复到可继续状态
  - _Requirements: 42_

- [x]* 15.4 进度反馈测试
  - _Requirements: 42_

## 16. Non-Linear Editing Workflow (Requirement 43)

- [x] 16.1 局部重算
  - 在选区内重算，保持上下文稳定
  - _Requirements: 43_

- [x] 16.2 Fill-in-the-middle
  - 根据前后文生成中间空缺和声
  - _Requirements: 43_

- [x] 16.3 一致性检查
  - 局部修改后检查邻接小节连贯性
  - _Requirements: 43_

- [x] 16.4 A/B 对比应用
  - 快速切换多个方案并一键应用
  - _Requirements: 43_

- [x]* 16.5 非线性流程测试
  - _Requirements: 43_

## 17. Explanation System (Requirement 44)

- [x] 17.1 三层解释展示
  - 对齐 `Explanation`：`one_liner`、`standard`、`deep`
  - _Requirements: 44_

- [x] 17.2 术语高亮与释义
  - 点击术语查看定义
  - _Requirements: 44_

- [x] 17.3 深度偏好记忆
  - 用户可设置默认解释深度
  - _Requirements: 44_

- [x]* 17.4 解释系统测试
  - _Requirements: 44_

## 18. Uncertainty Visualization (Requirement 45)

- [x] 18.1 三色置信可视化
  - 绿（可直接用）、黄（建议复核）、红（优先处理）
  - _Requirements: 45_

- [x] 18.2 置信分解展示
  - 对齐 `ConfidenceOutput.decomposition`
  - 拆分显示 key / omr / chord 置信度
  - _Requirements: 45_

- [x] 18.3 问题面板
  - 按置信度排序，支持按类型过滤
  - _Requirements: 45_

- [x]* 18.4 不确定性测试
  - _Requirements: 45_

## 19. Export and Sharing (Requirement 46)

- [x] 19.1 发布页与导出参数
  - 格式选择、版本选择、注释开关、页面参数
  - _Requirements: 46_

- [x] 19.2 对接已实现导出端点
  - `POST /api/export/abc`
  - `POST /api/export/png`
  - `POST /api/export/pdf`
  - _Requirements: 46_

- [x] 19.3 MusicXML 导出策略
  - 当前无独立 `/api/export/musicxml` 端点时，复用 harmonize 返回的 `musicxml`
  - _Requirements: 46_

- [x]* 19.4 导出测试
  - _Requirements: 46_

## 20. State Management Architecture

- [x] 20.1 Project Store
  - 当前项目、和弦序列、版本树、脏状态
  - _Requirements: 36, 43_

- [x] 20.2 UI Store
  - 当前视图、选区、侧栏状态、栏宽、热区面板
  - _Requirements: 31, 36, 45_

- [x] 20.3 User Preference Store
  - 难度、风格、解释深度、最近项目
  - _Requirements: 34, 44_

- [x]* 20.4 状态管理测试
  - _Requirements: 31-46_

## 21. Accessibility and Performance

- [x] 21.1 可访问性实现
  - 键盘可达、可见焦点、ARIA 标签、屏幕阅读器提示
  - _Requirements: 40_

- [x] 21.2 性能优化
  - 路由懒加载
  - 长列表虚拟化
  - 乐谱渲染缓存
  - _Requirements: 31, 38_

- [x] 21.3 性能指标基线
  - 首屏时间、首次分析可交互时间、切页耗时
  - _Requirements: 31_

- [x]* 21.4 可访问性与性能测试
  - _Requirements: 31, 40_

## 22. Checkpoint - Web Frontend Complete

- [x] 22.1 功能验收
  - 覆盖 requirements 31-46 的页面与流程
  - 当前可用端点全部联通
  - 未就绪端点具备 Mock/占位与切换机制

- [x] 22.2 质量门禁
  - 单元测试、集成测试、E2E 关键链路通过
  - 跨浏览器与多分辨率检查通过
  - 关键交互无阻塞错误

- [x] 22.3 文档交付
  - API 能力矩阵（已实现/规划中）
  - 前端类型契约文档（与 `src/index.ts` 对齐）
  - 页面级测试清单

---

## Notes

- 本文件已按当前代码实况对齐：`server/index.ts` 可用端点优先接通，规划端点采用 Adapter + Mock 并行开发。
- 所有任务默认 TypeScript 严格类型，禁止 `any` 扩散到业务核心层。
- 可选任务（`*`）为测试与质量增强，可在 MVP 阶段后补齐。

