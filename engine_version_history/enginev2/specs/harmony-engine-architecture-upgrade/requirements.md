# 需求文档：MeloChord 和声引擎架构升级

## 引言

MeloChord 是一个自动和声分析引擎，当前架构包括后端引擎（harmony-engine）和三个前端（移动端 App、微信小程序、Web 端）。当前系统基于 MusicXML/OMR → IR → 调性分析 → RAG 检索 → LLM 生成 → 验证 → 输出的流程。

基于三份评估与改进报告的深度分析，本需求文档旨在将系统从"能演示的研究型原型"升级为"优秀卓越、十分可用"的产品级和声分析引擎。核心改进方向是从"LLM 主导决策"转向"约束搜索 + LLM 辅助"的架构，建立专有的功能和声操作系统，并形成用户修正数据飞轮。

### 产品定位升级

本次升级将 MeloChord 从"自动配和弦工具"重新定位为**"AI 和声副驾 + 乐谱工作台 + 教学协作工具"**。这一定位围绕五大护城河展开：

1. **教学护城河（Teaching Moat）**：不仅提供答案，还提供功能解释、替代方案、难度分级、错误诊断
2. **编辑护城河（Editing Moat）**：支持局部改写、全局联动、重复乐句一致性，而非一次性生成
3. **数据护城河（Data Moat）**：教师和学生的真实修正数据持续反哺模型优化
4. **评测护城河（Evaluation Moat）**：系统性了解哪些场景易错、哪些风格受欢迎、哪些难度可接受
5. **机构护城河（Institution Moat）**：进入学校、工作室、教培机构后，沉淀的谱面、作业、修正轨迹和偏好难以迁移

### 双端定位策略

**Web 端 = 深度工作台**：负责导入、批量处理、精细校正、对比版本、课堂管理、导出与资产沉淀

**小程序/App 端 = 高频入口与陪伴端**：负责拍照/上传、即时查看结果、快速纠错、练习回看、分享给学生/同事、在碎片时间继续项目

### 核心设计理念

1. **AI 副驾，不抢主驾**：AI 提供建议而非强制决策，始终保留非 AI 路径
2. **乐谱是舞台，AI 是浮层**：主视觉围绕乐谱展开，AI 不能把用户拉离谱面
3. **先给结果，再给控制**：渐进揭示复杂功能，首要任务是快速看到有用结果
4. **非线性工作流**：支持选中区域局部重算、中间补全、保留上下文连续性
5. **依赖来自沉淀**：通过作品沉淀、偏好沉淀、关系沉淀、认知沉淀形成用户依赖

## 术语表

- **Harmony_Engine**：MeloChord 的后端和声分析引擎
- **IR**：中间表示（Intermediate Representation），系统内部的音乐结构化表示
- **RAG**：检索增强生成（Retrieval-Augmented Generation）
- **LLM**：大语言模型（Large Language Model）
- **OMR**：光学音乐识别（Optical Music Recognition）
- **Harmonic_Rhythm**：和声节奏，指和弦变化的时间模式
- **Candidate_Lattice**：候选格，包含所有可能和弦选择的结构化搜索空间
- **Functional_Harmony**：功能和声，基于主、下属、属功能的和声分析体系
- **Roman_Numeral**：罗马数字记谱法，用于表示和弦的功能关系
- **Cadence**：终止式，乐句结束处的和声进行模式
- **Validator**：验证器，检查和弦序列合理性的模块
- **Repairer**：修复器，自动修正不合理和弦的模块
- **Confidence_Score**：置信度分数，表示系统对输出结果的确定程度
- **Phrase_Segmentation**：乐句分段，将旋律划分为音乐意义上的乐句单元
- **MusicXML**：音乐交换格式标准
- **Viterbi_Algorithm**：维特比算法，用于全局最优路径搜索
- **Beam_Search**：束搜索，用于序列生成的搜索算法
- **Modal_Mixture**：调式混合，借用其他调式的和弦
- **Secondary_Dominant**：次属和弦，临时转向非主和弦的属和弦
- **Non_Chord_Tone**：非和弦音，不属于当前和弦的旋律音
- **Difficulty_Level**：难度级别，包括 basic、intermediate、advanced 三个等级
- **User_Correction_Loop**：用户修正闭环，收集并学习用户修改数据的机制
- **Pickup_Measure**：弱起小节（anacrusis），乐曲开始前的不完整小节
- **Tuplet**：连音符，如三连音、五连音等
- **Grace_Note**：装饰音，如倚音、颤音等
- **Tie**：连音线，连接相同音高的音符以延长时值
- **XML_AST**：XML 抽象语法树，用于结构化读写 XML 文档
- **Style_Profile**：风格配置，定义特定音乐风格的和声偏好
- **Mode_Unification**：调式统一，确保数据分片调式与分析器调式一致
- **Project_Library**：项目库，用户的音乐资产管理系统
- **Version_Tree**：版本树，记录和弦修正的历史版本
- **Classroom_Hub**：课堂中心，教师布置作业和学生提交的协作空间
- **Heat_Strip**：热区条，可视化显示置信度、OMR 风险、转调点的时间轴
- **AI_Shelf**：AI 建议货架，结构化展示候选和弦的组件
- **Why_Card**：解释卡，结构化说明和声选择理由的组件
- **Version_Lens**：版本透镜，对比多个版本的工具
- **Adaptive_Layout**：自适应布局，根据屏幕尺寸调整界面结构
- **Bottom_Sheet**：底部抽屉，移动端用于次级内容和操作的组件
- **Non_Linear_Workflow**：非线性工作流，支持局部重算和中间补全的创作模式

## 需求

### 优先级 P0：核心架构升级

#### 需求 1：候选和弦格生成系统

**用户故事：** 作为系统核心模块，我需要生成结构化的候选和弦空间，以便后续进行全局最优选择。

**接受标准**

1. WHEN 接收到旋律片段和调性信息，THE Candidate_Lattice_Generator SHALL 为每个时间跨度生成候选和弦集合
2. THE Candidate_Lattice_Generator SHALL 从规则路由、检索路由和模型路由三个来源生成候选
3. WHERE 规则路由被使用，THE Candidate_Lattice_Generator SHALL 基于局部调性、强拍音、终止式位置生成理论上合理的候选
4. WHERE 检索路由被使用，THE Candidate_Lattice_Generator SHALL 从相似乐句中提取常见功能和和声节奏模板
5. WHERE 模型路由被使用，THE Candidate_Lattice_Generator SHALL 使用符号模型或 LLM 提供 top-N 候选扩展
6. THE Candidate_Lattice_Generator SHALL 为每个候选和弦附加元数据（功能角色、置信度、难度级别）

#### 需求 2：全局约束解码器

**用户故事：** 作为和声决策核心，我需要从候选格中选择全局最优的和弦序列，以确保音乐连贯性和正确性。

**接受标准**

1. WHEN 候选格生成完成，THE Global_Decoder SHALL 使用动态规划或束搜索算法求解全局最优路径
2. THE Global_Decoder SHALL 计算局部得分（旋律-和弦匹配度、调性匹配度、强拍覆盖度、难度匹配度）
3. THE Global_Decoder SHALL 计算转移得分（功能推进合理性、终止式倾向、低音线平滑性、历史转移概率）
4. THE Global_Decoder SHALL 支持 Viterbi_Algorithm 和 Beam_Search 两种解码策略
5. THE Global_Decoder SHALL 在整句或 8 小节窗口中寻找最优序列
6. THE Global_Decoder SHALL 输出带置信度的和弦序列

#### 需求 3：LLM 角色重定位

**用户故事：** 作为系统架构师，我需要将 LLM 从主要决策者转变为辅助角色，以提高系统稳定性和可控性。

**接受标准**

1. THE LLM_Module SHALL NOT 直接输出最终和弦序列
2. WHEN 边界难例出现，THE LLM_Module SHALL 提供 top-N 补充候选
3. WHEN 和弦序列确定后，THE LLM_Module SHALL 生成解释文本说明和声选择理由
4. THE LLM_Module SHALL 在低置信区域参与候选重排序
5. THE LLM_Module SHALL 为用户生成教学性解释（如"为什么这里使用 ii-V-I"）

### 优先级 P0：和声节奏独立建模

#### 需求 4：和声节奏预测器

**用户故事：** 作为音乐分析模块，我需要独立预测和弦变化的时间位置，以避免固定分块导致的音乐不连贯。

**接受标准**

1. WHEN 接收到旋律序列，THE Harmonic_Rhythm_Predictor SHALL 预测和弦变化的时间位置
2. THE Harmonic_Rhythm_Predictor SHALL 考虑强拍位置、长时值音、休止符、乐句边界等因素
3. THE Harmonic_Rhythm_Predictor SHALL 根据难度级别调整和声节奏密度（basic 倾向一小节一和弦，advanced 允许更频繁变化）
4. THE Harmonic_Rhythm_Predictor SHALL 输出时间跨度列表，每个跨度对应一个和弦决策点
5. THE Harmonic_Rhythm_Predictor SHALL 为每个预测位置提供置信度分数

#### 需求 5：乐句分段系统

**用户故事：** 作为结构分析模块，我需要按音乐意义上的乐句边界分段，而非固定小节数，以提高和声连贯性。

**接受标准**

1. WHEN 接收到完整旋律，THE Phrase_Segmentation_Module SHALL 识别乐句边界
2. THE Phrase_Segmentation_Module SHALL 基于休止符、长音、终止感、节奏稀疏度、重复动机识别边界
3. THE Phrase_Segmentation_Module SHALL 支持重叠窗口处理跨句上下文
4. THE Phrase_Segmentation_Module SHALL 优先在乐句边界处进行和声决策
5. WHEN 乐句边界不明确，THE Phrase_Segmentation_Module SHALL 回退到 4 或 8 小节窗口

### 优先级 P0：验证器升级为修复器

#### 需求 6：三层纠错机制

**用户故事：** 作为质量保证模块，我需要不仅检测错误，还要自动修复问题，以提供更可靠的输出。

**接受标准**

1. WHEN 检测到强拍旋律音不在和弦内，THE Repairer SHALL 从候选集中切换到覆盖率更高的和弦
2. WHEN 检测到连续和弦转移概率极低，THE Repairer SHALL 尝试替换其中一个和弦
3. WHEN 检测到句尾不稳定，THE Repairer SHALL 强制尝试主和弦或属和弦终止候选
4. WHERE 异常小节被识别，THE Repairer SHALL 固定前后上下文并重新搜索该小节
5. IF 自动修复失败，THEN THE Repairer SHALL 标记该位置并提供 2-3 个备选方案
6. THE Repairer SHALL 为每个修复操作记录修复类型和置信度

### 优先级 P1：调性分析升级

#### 需求 7：功能状态机

**用户故事：** 作为调性分析模块，我需要追踪当前和声所处的功能区域，以约束和弦选择空间。

**接受标准**

1. WHEN 分析每个小节或半小节，THE Functional_State_Tracker SHALL 维护当前功能状态
2. THE Functional_State_Tracker SHALL 识别主功能区、下属功能区、属功能区、终止解决、调式混合、转调过渡等状态
3. THE Functional_State_Tracker SHALL 基于功能状态约束候选和弦搜索空间
4. THE Functional_State_Tracker SHALL 在句尾位置提高终止式候选的权重
5. THE Functional_State_Tracker SHALL 防止在不合理位置出现离调和弦

#### 需求 8：局部调性序列建模

**用户故事：** 作为调性分析模块，我需要将调性检测从单次判断升级为序列建模，以更准确处理转调。

**接受标准**

1. THE Key_Analyzer SHALL 使用序列模型（如 HMM 或 Viterbi）建模局部调性序列
2. THE Key_Analyzer SHALL 引入调性惯性（key inertia）和转调惩罚（modulation penalty）
3. THE Key_Analyzer SHALL 考虑终止式线索、旋律模式、隐含和声等结构信息
4. THE Key_Analyzer SHALL 支持和弦候选反向修正调性判断
5. THE Key_Analyzer SHALL 为每个时间点输出调性和调式的置信度分布

### 优先级 P1：RAG 检索升级

#### 需求 9：和声语义相似检索

**用户故事：** 作为检索模块，我需要从"旋律相似"升级到"和声语义相似"，以提供更相关的参考案例。

**接受标准**

1. THE RAG_Module SHALL 提取重拍骨干音序列（每拍第一个音、每小节重音位音、长时值音）
2. THE RAG_Module SHALL 提取句法位置标签（开始句、中段、半终止前、完全终止前、尾句）
3. THE RAG_Module SHALL 提取旋律稳定度特征（和弦音倾向强弱、非和弦音密度、音高重心）
4. THE RAG_Module SHALL 提取节奏-和声耦合特征（一小节一和弦适配度、两拍一和弦适配度）
5. THE RAG_Module SHALL 提取终止式模式特征（句尾音级与终止类型关联）
6. THE RAG_Module SHALL 返回相似片段的和弦候选统计、功能分布、终止分布

#### 需求 10：混合检索策略

**用户故事：** 作为检索模块，我需要结合符号检索和密集向量检索，以提高检索质量。

**接受标准**

1. THE RAG_Module SHALL 首先按调性、拍号、乐句长度、和声密度、终止类型进行过滤
2. THE RAG_Module SHALL 使用音级 n-gram、拍位模式、音程轮廓进行稀疏符号检索
3. THE RAG_Module SHALL 使用转调归一化后的旋律编码器进行密集向量检索
4. THE RAG_Module SHALL 融合稀疏和密集检索结果
5. THE RAG_Module SHALL 返回和声节奏模板、功能路径、表层和弦实现方案

### 优先级 P1：难度系统升级

#### 需求 11：分层策略生成

**用户故事：** 作为难度控制模块，我需要将难度从事后过滤升级为前置搜索空间约束，以生成更自然的分级结果。

**接受标准**

1. WHERE Difficulty_Level 为 basic，THE Difficulty_Controller SHALL 限制候选空间为 I、IV、V、vi 和弦
2. WHERE Difficulty_Level 为 basic，THE Difficulty_Controller SHALL 优先一小节一和弦的和声节奏
3. WHERE Difficulty_Level 为 basic，THE Difficulty_Controller SHALL 在句尾优先使用 V-I 终止
4. WHERE Difficulty_Level 为 intermediate，THE Difficulty_Controller SHALL 允许 ii、iii、viio、V7、ii7、IVmaj7 等和弦
5. WHERE Difficulty_Level 为 intermediate，THE Difficulty_Controller SHALL 允许两拍一和弦的和声节奏
6. WHERE Difficulty_Level 为 advanced，THE Difficulty_Controller SHALL 允许调式混合、次属和弦、经过减七、挂留和弦、延伸和弦
7. THE Difficulty_Controller SHALL 根据难度级别调整搜索空间和打分权重

### 优先级 P1：IR 表示层增强

#### 需求 12：功能和声双层表示

**用户故事：** 作为 IR 设计者，我需要在内部同时维护功能层和表层两种和声表示，以支持可控生成和可解释输出。

**接受标准**

1. THE IR SHALL 为每个和弦存储局部调性和调式信息
2. THE IR SHALL 为每个和弦存储 Roman_Numeral 和功能角色（主、下属、属）
3. THE IR SHALL 为每个和弦存储转位和斜线低音信息
4. THE IR SHALL 为每个和弦存储加音、省音、延伸音信息
5. THE IR SHALL 为每个和弦存储和声节奏跨度（起始时间和持续时长）
6. THE IR SHALL 为每个和弦存储终止式角色标签
7. THE IR SHALL 为每个和弦存储置信度分数
8. THE IR SHALL 为每个和弦存储教学难度标签
9. THE IR SHALL 支持从功能层到表层的双向转换

#### 需求 13：音符显著性分析

**用户故事：** 作为 IR 模块，我需要为每个旋律音标注其音乐重要性，以指导和弦选择。

**接受标准**

1. THE IR SHALL 为每个音符计算拍位权重（强拍、弱拍、次强拍）
2. THE IR SHALL 为每个音符计算时值权重（长音更重要）
3. THE IR SHALL 为每个音符标注非和弦音类型（经过音、邻音、倚音、挂留音、延留音）
4. THE IR SHALL 为每个音符计算和弦音倾向强度
5. THE IR SHALL 识别乐句边界位置的音符

#### 需求 14：Parser 层音乐结构补强

**用户故事：** 作为 Parser 模块，我需要正确处理各种复杂音乐记谱，以确保分析的准确性。

**接受标准**

1. THE Parser SHALL 正确识别和处理弱起小节（pickup / anacrusis），将其时值计入乐句分析
2. THE Parser SHALL 正确解析三连音（triplets）、五连音（quintuplets）等各类 tuplets
3. THE Parser SHALL 识别装饰音（grace notes）和装饰记号（ornaments），并在和声分析时适当忽略或降低权重
4. THE Parser SHALL 正确处理跨小节的连音线（ties），将连接的音符时值合并
5. THE Parser SHALL 支持多声部输入时的主旋律声部选择，而不仅限于"第一个 part"
6. THE Parser SHALL 提供主旋律声部选择策略（最高音、最活跃声部、用户指定）
7. THE Parser SHALL 在 IR 中标注装饰音和连音符信息，供后续模块参考

### 优先级 P1：MusicXML 输出层工程升级

#### 需求 15：XML AST 结构化输出

**用户故事：** 作为输出模块，我需要使用结构化的 XML 操作替代正则表达式注入，以支持复杂和声表示。

**接受标准**

1. THE MusicXML_Output_Module SHALL 使用 XML AST 读写库（如 fast-xml-parser）替代正则表达式注入
2. THE MusicXML_Output_Module SHALL 正确输出转位和弦和斜线和弦（使用 `<bass>` 元素）
3. THE MusicXML_Output_Module SHALL 正确输出加音、省音和弦（使用 `<degree>` 元素的 add/alter/subtract）
4. THE MusicXML_Output_Module SHALL 支持 Roman numeral 显示（使用 `<numeral>` 元素或 `<root-step>` + `<kind text="...">`）
5. THE MusicXML_Output_Module SHALL 支持精确的和弦时间偏移（使用 `<offset>` 元素）
6. THE MusicXML_Output_Module SHALL 支持多谱表和声标注的位置控制（使用 `<staff>` 元素）
7. THE MusicXML_Output_Module SHALL 保持原始 MusicXML 的其他元素（力度、表情、歌词等）不被破坏

### 优先级 P1：调式统一

#### 需求 16：数据分片与分析器调式一致性

**用户故事：** 作为系统架构师，我需要确保 RAG 数据分片的调式分类与调性分析器的调式判断保持一致。

**接受标准**

1. THE Key_Analyzer SHALL 支持识别 major、minor、mixolydian、lydian、phrygian 等调式
2. THE Key_Analyzer SHALL 输出的调式标签与 RAG 数据分片的调式分类完全一致
3. THE RAG_Module SHALL 根据 Key_Analyzer 输出的调式选择对应的 embedding 数据分片
4. THE System SHALL 建立调式映射表，确保分析器和数据层使用统一的调式定义
5. WHEN 调性分析输出非标准调式，THE RAG_Module SHALL 映射到最接近的数据分片调式
6. THE System SHALL 在配置文件中明确定义支持的调式列表及其特征音阶

### 优先级 P2：风格控制系统

#### 需求 17：多风格和声生成

**用户故事：** 作为用户，我需要系统支持不同音乐风格的和声生成，以满足多样化需求。

**接受标准**

1. THE Harmony_Engine SHALL 支持至少 4 种风格配置：pop、hymn、classical-lite、jazz-lite
2. WHERE Style_Profile 为 pop，THE Harmony_Engine SHALL 优先使用流行音乐常见进行（如 I-V-vi-IV、ii-V-I）
3. WHERE Style_Profile 为 hymn，THE Harmony_Engine SHALL 优先使用四部和声写作规则和传统终止式
4. WHERE Style_Profile 为 classical-lite，THE Harmony_Engine SHALL 强调功能和声进行和规范的声部进行
5. WHERE Style_Profile 为 jazz-lite，THE Harmony_Engine SHALL 允许更多延伸和弦、次属和弦和替代和弦
6. THE Harmony_Engine SHALL 允许用户在生成前选择风格，或生成后切换风格重新生成
7. THE Harmony_Engine SHALL 为每种风格维护独立的和弦转移概率矩阵和候选权重

#### 需求 18：用户与机构风格偏好学习

**用户故事：** 作为系统学习模块，我需要学习不同用户和机构的风格偏好，以提供个性化服务。

**接受标准**

1. THE User_Correction_Loop SHALL 为每个用户维护风格偏好画像
2. THE User_Correction_Loop SHALL 为每个机构（学校、工作室）维护共享风格偏好
3. THE Harmony_Engine SHALL 支持基于用户历史修正数据的候选重排序
4. THE Harmony_Engine SHALL 允许机构上传私有曲库作为风格参考
5. THE Harmony_Engine SHALL 支持基于机构曲库的模型微调或检索增强
6. THE Harmony_Engine SHALL 在用户界面显示"根据您的偏好调整"的提示

### 优先级 P2：OMR 置信度与误差吸收

#### 需求 19：OMR 不确定性传播

**用户故事：** 作为 OMR 接口模块，我需要将识别不确定性传递给和声引擎，以避免基于错误输入做出错误决策。

**接受标准**

1. WHEN OMR 输出包含置信度信息，THE OMR_Interface SHALL 保留并传播置信度到 IR 层
2. WHEN 检测到音高明显越界，THE OMR_Interface SHALL 标记该音符为低置信
3. WHEN 检测到小节时值不守恒，THE OMR_Interface SHALL 标记该小节为低置信
4. WHEN 检测到连续音程异常跳变，THE OMR_Interface SHALL 标记相关音符为低置信
5. WHEN 检测到调号与临时记号冲突，THE OMR_Interface SHALL 标记相关区域为低置信
6. THE OMR_Interface SHALL 为低置信区域生成多个候选符号解释

#### 需求 20：误差感知和声解码

**用户故事：** 作为和声解码器，我需要在 OMR 不确定性高的区域采用更保守的策略，以提高鲁棒性。

**接受标准**

1. WHEN 某音符置信度低，THE Global_Decoder SHALL 降低依赖该音符的和弦候选权重
2. WHEN 某区域 OMR 质量差，THE Global_Decoder SHALL 优先选择更稳定的基础和弦
3. WHEN 某区域 OMR 质量差，THE Global_Decoder SHALL 倾向更稀疏的和声节奏
4. WHEN 存在多个符号候选，THE Global_Decoder SHALL 保留多条局部路径并延迟决策
5. WHEN OMR 整体质量差，THE Global_Decoder SHALL 在输出中提示用户核对谱面

### 优先级 P2：用户编辑闭环

#### 需求 21：交互式和弦编辑

**用户故事：** 作为用户，我需要能够查看和修改系统生成的和弦，以满足个性化需求。

**接受标准**

1. WHEN 用户点击某小节，THE UI SHALL 显示当前和弦和 top-3 备选和弦
2. WHEN 用户选择备选和弦，THE Harmony_Engine SHALL 替换该和弦并重新评估相邻小节
3. WHEN 用户修改和弦，THE Harmony_Engine SHALL 记录修改操作（原和弦、新和弦、上下文）
4. THE UI SHALL 支持用户手动输入自定义和弦
5. THE UI SHALL 提供回放功能以试听修改效果
6. THE UI SHALL 支持导出修正后的 MusicXML、ABC、PDF 格式

#### 需求 22：用户修正数据收集

**用户故事：** 作为系统学习模块，我需要收集用户修正数据，以持续改进系统性能。

**接受标准**

1. WHEN 用户接受系统建议，THE User_Correction_Loop SHALL 记录接受事件
2. WHEN 用户拒绝系统建议，THE User_Correction_Loop SHALL 记录拒绝事件和原因（如果提供）
3. WHEN 用户修改和弦，THE User_Correction_Loop SHALL 记录修改前后对比和上下文
4. THE User_Correction_Loop SHALL 统计哪些位置、哪些和弦类型最常被修改
5. THE User_Correction_Loop SHALL 区分教师用户和学生用户的修正模式
6. THE User_Correction_Loop SHALL 定期分析修正数据以优化候选生成和重排序策略

### 优先级 P2：多候选输出

#### 需求 23：多版本和声生成

**用户故事：** 作为用户，我需要系统提供多个和声版本，以便选择最适合的方案。

**接受标准**

1. THE Harmony_Engine SHALL 为同一旋律生成至少 3 个不同版本的和声
2. THE Harmony_Engine SHALL 提供"教学稳妥版"（最简单、最传统）
3. THE Harmony_Engine SHALL 提供"流行常用版"（符合流行音乐习惯）
4. THE Harmony_Engine SHALL 提供"稍丰富版"（使用更多和弦类型和转位）
5. THE Harmony_Engine SHALL 为每个版本提供简短描述和适用场景
6. THE Harmony_Engine SHALL 允许用户在不同版本间切换并比较

### 优先级 P2：评测基准建立

#### 需求 24：多维度评测体系

**用户故事：** 作为系统评估者，我需要建立全面的评测基准，以量化系统性能和改进效果。

**接受标准**

1. THE Evaluation_System SHALL 建立干净 MusicXML 教学曲基准集（至少 100 首）
2. THE Evaluation_System SHALL 建立真实 OMR 噪声对照基准集
3. THE Evaluation_System SHALL 建立风格外测试集（hymn、folk、jazz-lite、modal）
4. THE Evaluation_System SHALL 计算和弦序列指标（CHE、CC、CTD）
5. THE Evaluation_System SHALL 计算旋律-和弦一致性指标（CTnCTR、PCS、MCTD）
6. THE Evaluation_System SHALL 计算和声节奏指标（rhythm complexity、harmonic density）
7. THE Evaluation_System SHALL 计算终止式成功率
8. THE Evaluation_System SHALL 计算用户接受率和平均修改次数
9. THE Evaluation_System SHALL 支持自动化评测脚本

### 优先级 P3：置信度标定

#### 需求 25：置信度输出与校准

**用户故事：** 作为用户，我需要知道系统对每个输出的确定程度，以便判断是否需要人工检查。

**接受标准**

1. THE Harmony_Engine SHALL 为每个和弦输出置信度分数（0-1 范围）
2. THE Harmony_Engine SHALL 为每个小节输出整体置信度分数
3. THE Harmony_Engine SHALL 为整首曲目输出平均置信度
4. WHEN 置信度低于阈值，THE UI SHALL 高亮显示该区域
5. THE Harmony_Engine SHALL 定期校准置信度，使低置信区域与实际用户修改率相关
6. THE Harmony_Engine SHALL 提供置信度分解（调性置信度、OMR 置信度、和弦置信度）

### 优先级 P3：解释层构建

#### 需求 26：教学性解释生成

**用户故事：** 作为学习者或教师，我需要理解系统为什么选择某个和弦，以便学习和声知识。

**接受标准**

1. WHEN 用户请求解释，THE Explanation_Module SHALL 说明当前和弦的功能角色
2. THE Explanation_Module SHALL 说明为什么在此处变换和弦（和声节奏理由）
3. THE Explanation_Module SHALL 标注旋律音是和弦音还是非和弦音
4. THE Explanation_Module SHALL 说明当前和弦在终止式中的作用（如果适用）
5. THE Explanation_Module SHALL 提供更简化版本和更进阶版本的建议
6. THE Explanation_Module SHALL 使用教学友好的语言（如"这里使用 ii-V-I 进行，是爵士和流行音乐中常见的终止式"）

### 优先级 P3：性能优化与成本控制

#### 需求 27：缓存与降级策略

**用户故事：** 作为系统运维者，我需要控制 API 调用成本并提高响应速度。

**接受标准**

1. THE Harmony_Engine SHALL 缓存查询级 embedding 结果
2. THE Harmony_Engine SHALL 缓存旋律段哈希对应的和声结果
3. THE Harmony_Engine SHALL 缓存常见示例的完整结果
4. THE Harmony_Engine SHALL 缓存 RAG top-K 检索结果
5. THE Harmony_Engine SHALL 缓存 LLM 响应（按 prompt hash）
6. IF embedding 服务失败，THEN THE Harmony_Engine SHALL 使用规则候选和历史转移矩阵
7. IF LLM 服务失败，THEN THE Harmony_Engine SHALL 使用动态规划搜索直接产出保守版
8. IF OMR 服务失败，THEN THE Harmony_Engine SHALL 提示用户上传更清晰图片并返回预处理结果预览
9. IF 渲染服务失败，THEN THE Harmony_Engine SHALL 先提供 MusicXML 和 ABC 文本格式结果

#### 需求 28：小型专用符号模型蒸馏

**用户故事：** 作为系统架构师，我需要减少对外部 LLM API 的依赖，以降低成本和提高响应速度。

**接受标准**

1. THE Harmony_Engine SHALL 支持使用小型专用符号模型替代部分 LLM 调用
2. THE Model_Distillation_Module SHALL 从用户修正数据和 LLM 输出中学习蒸馏模型
3. THE Harmony_Engine SHALL 优先使用本地小模型生成候选，仅在低置信区域调用 LLM
4. THE Harmony_Engine SHALL 定期评估小模型性能，确保不低于质量阈值
5. THE Harmony_Engine SHALL 支持小模型的增量训练和在线学习
6. THE Harmony_Engine SHALL 在配置中允许选择"仅本地模型"、"混合模式"、"仅 LLM"三种运行模式

### 优先级 P3：重复乐句一致性

#### 需求 29：重复模式识别与一致性保持

**用户故事：** 作为音乐分析模块，我需要识别重复乐句并保持和声一致性，以符合音乐习惯。

**接受标准**

1. WHEN 检测到重复旋律模式，THE Phrase_Analyzer SHALL 标记为重复乐句组
2. THE Global_Decoder SHALL 优先为重复乐句分配相同或相似的和声
3. WHERE 重复乐句出现在不同句法位置，THE Global_Decoder SHALL 允许适当变化（如半终止 vs 完全终止）
4. THE Global_Decoder SHALL 在目标函数中加入重复乐句一致性项
5. WHEN 用户修改某个重复乐句的和声，THE Harmony_Engine SHALL 询问是否同步修改其他重复乐句

### 优先级 P3：法律与合规

#### 需求 30：Audiveris AGPL 许可证风险评估

**用户故事：** 作为项目负责人，我需要评估和管理 Audiveris AGPL v3 许可证带来的法律风险。

**接受标准**

1. THE Project_Team SHALL 进行专门的法律评估，明确 Audiveris AGPL v3 许可证对 SaaS 服务的影响
2. THE Project_Team SHALL 评估"修改版网络服务"是否触发源代码提供义务
3. THE Project_Team SHALL 制定 Audiveris 使用策略：保持原样使用、替换为其他 OMR、或自研 OMR
4. IF 决定深度改造 Audiveris，THEN THE Project_Team SHALL 准备源代码公开方案
5. IF 决定替换 Audiveris，THEN THE Project_Team SHALL 评估备选 OMR 方案（商业 API、其他开源项目、自研）
6. THE Project_Team SHALL 在系统文档中明确记录 OMR 组件的许可证状态和合规策略
7. THE Project_Team SHALL 定期（至少每年一次）复审许可证合规状态


---

## Web 端需求

### 优先级 P0：Web 端核心架构

#### 需求 31：三栏式深度工作台布局

**用户故事：** 作为 Web 端用户，我需要一个稳定的三栏布局，以便同时查看项目结构、乐谱内容和智能分析。

**接受标准**

1. THE Web_UI SHALL 采用三栏布局：左栏（导航与项目结构）、中栏（乐谱主舞台）、右栏（智能洞察与操作）
2. THE Web_UI SHALL 在 1440px 以上显示完整三栏
3. THE Web_UI SHALL 在 1024-1439px 将右栏变为可折叠侧边 sheet
4. THE Web_UI SHALL 在 768-1023px 将左栏收缩为图标导航，右栏默认隐藏
5. THE Web_UI SHALL 在 768px 以下退化为轻量浏览态
6. THE Web_UI SHALL 保持中栏乐谱区域始终为视觉焦点
7. THE Web_UI SHALL 支持用户自定义左右栏宽度并记忆偏好

#### 需求 32：一级导航系统

**用户故事：** 作为用户，我需要清晰的一级导航，以便快速访问主要功能区域。

**接受标准**

1. THE Web_UI SHALL 提供 6 个一级导航入口：工作台、项目库、课堂/协作、模板与风格、资源中心、设置
2. THE Web_UI SHALL 将"工作台"设为默认主入口
3. THE Web_UI SHALL 在导航项上显示未读通知数量（如待确认小节数、新评论数）
4. THE Web_UI SHALL 支持键盘快捷键快速切换导航（Cmd/Ctrl + 1-6）
5. THE Web_UI SHALL 在移动端将一级导航收缩为汉堡菜单


#### 需求 33：视觉系统与设计语言

**用户故事：** 作为用户，我需要一个现代、专业且具有东方气质的视觉系统，以便长时间舒适使用。

**接受标准**

1. THE Web_UI SHALL 使用暖纸色或浅雾灰作为背景，减轻长时间阅读疲劳
2. THE Web_UI SHALL 使用高亮白作为主内容面，保证谱面清晰
3. THE Web_UI SHALL 使用青黛/玉色作为主强调色，体现专业与冷静
4. THE Web_UI SHALL 使用朱砂/琥珀作为次强调色，用于低置信、警示、需确认区域
5. THE Web_UI SHALL 为难度标签使用不同颜色：basic=青绿、intermediate=靛蓝、advanced=紫红
6. THE Web_UI SHALL 为置信度使用颜色编码：高=绿、中=琥珀、低=红
7. THE Web_UI SHALL 使用现代无衬线字体作为界面主字体
8. THE Web_UI SHALL 为数字简谱、拍号、节奏信息使用等宽数字字体
9. THE Web_UI SHALL 动效仅用于状态变化、注意力转移、面板呼出收起、生成过程反馈、对比切换
10. THE Web_UI SHALL 遵循基于物理的 motion 体系，保持流畅自然的转场

### 优先级 P0：Web 端关键页面

#### 需求 34：首页/项目总览页

**用户故事：** 作为用户，我需要一个能快速恢复上下文的首页，以便无摩擦继续工作。

**接受标准**

1. THE Web_Home_Page SHALL 在顶部 Hero 区域显示：继续上次项目、快速上传、体验示例
2. THE Web_Home_Page SHALL 按"待确认""已完成""课堂中""收藏模板"分组显示最近项目
3. THE Web_Home_Page SHALL 提供快速入口：上传乐谱、批量 OMR、从示例开始、导入 MusicXML
4. THE Web_Home_Page SHALL 显示智能提示：最近常用难度/风格、一键恢复上次工作环境
5. THE Web_Home_Page SHALL 支持全局搜索：按曲名、调性、和弦、老师备注、学生名检索
6. THE Web_Home_Page SHALL 记住用户上次停下的小节位置，点击继续时直接定位


#### 需求 35：导入中心

**用户故事：** 作为用户，我需要一个统一的导入中心，以便处理各种格式的乐谱输入。

**接受标准**

1. THE Import_Hub SHALL 支持拖拽上传、批量上传、摄影谱面导入、PDF 多页识别、直接粘贴 MusicXML
2. THE Import_Hub SHALL 自动识别文件类型（PDF、PNG、JPG、MusicXML、ABC）
3. THE Import_Hub SHALL 在上传前提供即时预览
4. THE Import_Hub SHALL 显示页数、清晰度评估、疑似风险提示
5. THE Import_Hub SHALL 允许用户选择"仅识谱"或"一步配和弦"
6. THE Import_Hub SHALL 显示最近导入历史，支持快速重新处理
7. THE Import_Hub SHALL 在检测到低质量图片时提示用户调整拍摄角度或光线

#### 需求 36：分析工作台

**用户故事：** 作为用户，我需要一个功能完整的分析工作台，以便深度编辑和审核和声结果。

**接受标准**

1. THE Analysis_Workbench SHALL 提供 5 个可切换视图：领谱视图、五线谱视图、简谱视图、功能和声视图、对比视图
2. THE Analysis_Workbench SHALL 在中栏顶部放置视图切换分段控件
3. THE Analysis_Workbench SHALL 在右栏同步展示当前视图相关信息
4. THE Analysis_Workbench SHALL 提供双层时间轴：调性变化轨、和声节奏轨、低置信热区轨、问题事件点轨
5. THE Analysis_Workbench SHALL 支持用户在谱面上直接框选 1-8 小节进行局部操作
6. THE Analysis_Workbench SHALL 为框选区域提供浮动工具条：重新生成、降低难度、提高色彩、更稳定伴奏、更流行/更抒情、查看替代方案
7. THE Analysis_Workbench SHALL 支持 A/B 切换预览候选方案
8. THE Analysis_Workbench SHALL 自动记录每次修改为版本节点
9. THE Analysis_Workbench SHALL 支持撤销/重做，固定可见
10. THE Analysis_Workbench SHALL 支持一键恢复到"系统首版"


#### 需求 37：审核/修正模式

**用户故事：** 作为用户，我需要一个专门的审核模式，以便系统性地确认和修正低置信区域。

**接受标准**

1. THE Review_Mode SHALL 在中间显示当前小节与相邻上下文
2. THE Review_Mode SHALL 在右侧显示 top-3 候选和弦
3. THE Review_Mode SHALL 在下方显示选择理由：旋律覆盖、功能位置、转调、相似片段参考
4. THE Review_Mode SHALL 支持在顶部切换 basic/intermediate/advanced 或风格预设
5. THE Review_Mode SHALL 自动定位到第一个低置信小节
6. THE Review_Mode SHALL 提供"下一个待确认"快捷键（Space 或 →）
7. THE Review_Mode SHALL 显示审核进度：已确认 X/Y 处
8. THE Review_Mode SHALL 支持标记"稍后处理"并跳过当前小节

#### 需求 38：项目库

**用户故事：** 作为用户，我需要一个音乐资产管理系统，以便组织和复用我的作品。

**接受标准**

1. THE Project_Library SHALL 以卡片形式展示曲目，包含封面、标题、状态标签
2. THE Project_Library SHALL 显示最近导出格式、教学用途标记、常用模板关联
3. THE Project_Library SHALL 显示修改人和修改时间
4. THE Project_Library SHALL 记录"导入自哪里、导出到哪里、版本兼容信息"
5. THE Project_Library SHALL 支持按状态、难度、风格、调性、创建时间筛选
6. THE Project_Library SHALL 支持批量操作：导出、删除、归档、分享
7. THE Project_Library SHALL 支持文件夹组织和标签管理
8. THE Project_Library SHALL 显示项目统计：总小节数、低置信数、修正次数、导出次数


#### 需求 39：课堂/协作中心

**用户故事：** 作为教师，我需要一个课堂协作中心，以便布置作业、收集提交、批改反馈。

**接受标准**

1. THE Classroom_Hub SHALL 支持教师创建班级并邀请学生
2. THE Classroom_Hub SHALL 支持教师布置作业：上传旋律，要求学生解释和声
3. THE Classroom_Hub SHALL 支持学生提交修正版和声方案
4. THE Classroom_Hub SHALL 支持教师在谱面上直接评论和标注
5. THE Classroom_Hub SHALL 提供版本对比功能：系统生成版 vs 学生修正版
6. THE Classroom_Hub SHALL 支持打分维度：和弦合理性、功能连贯性、转调处理、解释完整度
7. THE Classroom_Hub SHALL 支持批量反馈和常用评语模板
8. THE Classroom_Hub SHALL 显示班级统计：提交率、平均分、常见错误类型
9. THE Classroom_Hub SHALL 支持作业模板库：常见教学曲目、分级练习
10. THE Classroom_Hub SHALL 支持学生查看历史作业和进步曲线

### 优先级 P1：Web 端组件系统

#### 需求 40：核心 UI 组件

**用户故事：** 作为前端开发者，我需要一套标准化的 UI 组件，以便保持界面一致性。

**接受标准**

1. THE Component_System SHALL 提供和弦胶囊组件（Chord Capsule），显示和弦名、功能级数、难度级别、置信度色边、是否用户手改
2. THE Component_System SHALL 提供小节热区条组件（Measure Heat Strip），用细色带显示高置信、低置信、OMR 风险、转调点、节点异常
3. THE Component_System SHALL 提供 AI 建议货架组件（AI Shelf），以卡片形式展示候选，每张卡包含试听、应用、对比、收藏为模板、推荐理由
4. THE Component_System SHALL 提供解释卡组件（Why Card），结构化展示当前调性、旋律重音、和声功能、非和弦音、替代方案对比
5. THE Component_System SHALL 提供版本透镜组件（Version Lens），支持对比原谱、系统版、用户修正版、教学标准版
6. THE Component_System SHALL 所有组件遵循统一的视觉系统和交互规范
7. THE Component_System SHALL 所有组件支持键盘导航和无障碍访问


### 优先级 P1：Web 端交互设计

#### 需求 41：首次使用流程

**用户故事：** 作为新用户，我需要一个轻量的首次使用流程，以便快速体验产品价值。

**接受标准**

1. THE Onboarding_Flow SHALL 允许用户无需注册即可试用示例曲或上传一页谱
2. THE Onboarding_Flow SHALL 在首次成功后轻问用户角色：老师、学习者、创作者
3. THE Onboarding_Flow SHALL 根据角色调整默认首页和推荐内容，但不锁死功能
4. THE Onboarding_Flow SHALL 在第一次结果页先展示摘要：谱面已识别、已生成和弦、X 处建议复核
5. THE Onboarding_Flow SHALL 避免使用轮播式新手教程，采用情境化引导
6. THE Onboarding_Flow SHALL 在用户完成第一次修正后提示注册以保存项目

#### 需求 42：上传与分析进度反馈

**用户故事：** 作为用户，我需要清晰的进度反馈，以便了解系统正在做什么。

**接受标准**

1. THE Progress_Feedback SHALL 将长耗时任务拆成可见阶段：上传文件、识谱中、解析旋律、分析调性、生成和弦、验证结果、渲染完成
2. THE Progress_Feedback SHALL 为每个阶段提供人话提示（如"正在识别五线谱结构""正在判断局部调性变化"）
3. THE Progress_Feedback SHALL 在检测到 OMR 风险时前置提醒："本页结果可能受影响"
4. THE Progress_Feedback SHALL 显示当前处理进度百分比和预计剩余时间
5. THE Progress_Feedback SHALL 支持用户取消长时间任务
6. THE Progress_Feedback SHALL 在任务完成后自动跳转到结果页


#### 需求 43：局部修正与非线性工作流

**用户故事：** 作为用户，我需要支持非线性创作的工作流，以便灵活地修改和声。

**接受标准**

1. THE Non_Linear_Workflow SHALL 支持用户在谱面上直接框选 1-8 小节
2. THE Non_Linear_Workflow SHALL 为框选区域显示浮动工具条，提供局部操作选项
3. THE Non_Linear_Workflow SHALL 支持局部重新生成，保留上下文连续性
4. THE Non_Linear_Workflow SHALL 支持在中间空白处补全和声
5. THE Non_Linear_Workflow SHALL 支持 fill-in-the-middle 模式，根据前后上下文生成中间部分
6. THE Non_Linear_Workflow SHALL 在局部修改后自动检查与相邻小节的连贯性
7. THE Non_Linear_Workflow SHALL 支持多个候选方案的 A/B 切换预览
8. THE Non_Linear_Workflow SHALL 在应用候选前显示局部预览，确认后才提交

#### 需求 44：解释系统交互

**用户故事：** 作为用户，我需要理解系统的和声选择理由，以便学习和信任系统。

**接受标准**

1. THE Explanation_System SHALL 提供三层解释深度：一句话解释、标准解释、深度解释
2. THE Explanation_System SHALL 一句话解释适合老师演示或快速确认
3. THE Explanation_System SHALL 标准解释包含功能、旋律音、终止式、替代关系
4. THE Explanation_System SHALL 深度解释适合学习者，带乐理术语和参考相似片段
5. THE Explanation_System SHALL 解释嵌入 Why Card、问题面板和 hover 提示，而非自由聊天
6. THE Explanation_System SHALL 支持用户选择默认解释粒度并记忆偏好
7. THE Explanation_System SHALL 在解释中高亮关键术语，点击可查看定义


#### 需求 45：错误与不确定性可视化

**用户故事：** 作为用户，我需要清晰地看到系统的不确定性，以便做出明智的决策。

**接受标准**

1. THE Uncertainty_Visualization SHALL 使用三色系统：绿色=可直接用、琥珀=建议确认、红色=建议优先复核
2. THE Uncertainty_Visualization SHALL 在小节热区条上显示置信度分布
3. THE Uncertainty_Visualization SHALL 在低置信小节上显示警示图标
4. THE Uncertainty_Visualization SHALL 提供不确定性分解：调性置信度、OMR 置信度、和弦置信度
5. THE Uncertainty_Visualization SHALL 在问题面板中列出所有需确认的位置
6. THE Uncertainty_Visualization SHALL 支持按置信度排序和筛选
7. THE Uncertainty_Visualization SHALL 在用户确认后更新置信度显示

#### 需求 46：导出与分享

**用户故事：** 作为用户，我需要灵活的导出和分享选项，以便在不同场景使用结果。

**接受标准**

1. THE Export_System SHALL 提供完整的"发布页"而非简单弹窗
2. THE Export_System SHALL 支持导出格式：PDF、PNG、MusicXML、ABC
3. THE Export_System SHALL 支持导出当前版本或某个历史版本
4. THE Export_System SHALL 支持选择是否附带和声解释
5. THE Export_System SHALL 支持选择教师批注是否可见
6. THE Export_System SHALL 支持生成只读链接或可评论链接
7. THE Export_System SHALL 支持批量导出多个项目
8. THE Export_System SHALL 记录导出历史，支持快速重新导出
9. THE Export_System SHALL 在导出前预览最终效果
10. THE Export_System SHALL 支持自定义导出参数：页面大小、分辨率、字体大小



---

## 移动端需求（小程序/App）

### 优先级 P0：移动端核心架构

#### 需求 47：移动端定位与能力分工

**用户故事：** 作为产品设计者，我需要明确小程序和 App 的能力定位，以便提供最佳用户体验。

**接受标准**

1. THE Mobile_Platform SHALL 将小程序定位为：轻入口、轻编辑、强分享
2. THE Mobile_Platform SHALL 将 App 定位为：强陪伴、强复用、强练习
3. THE Mobile_Platform SHALL 小程序支持从微信聊天/群直接打开文件
4. THE Mobile_Platform SHALL 小程序支持临时拍照上传和快速查看结果
5. THE Mobile_Platform SHALL 小程序支持分享给学生、家长、同事
6. THE Mobile_Platform SHALL 小程序支持课堂中扫码进入作业或示例
7. THE Mobile_Platform SHALL App 支持项目库长期管理
8. THE Mobile_Platform SHALL App 支持高频练习、播放、跟练功能
9. THE Mobile_Platform SHALL App 支持通知提醒和离线访问
10. THE Mobile_Platform SHALL 两端数据实时同步，支持跨端无缝继续

#### 需求 48：移动端视觉系统

**用户故事：** 作为移动端用户，我需要一个轻量、清晰的视觉系统，以便在小屏幕上舒适使用。

**接受标准**

1. THE Mobile_UI SHALL 保留 Web 端气质，但更轻、更直接
2. THE Mobile_UI SHALL 使用更纯净的背景和更多留白
3. THE Mobile_UI SHALL 让谱面优先占据屏幕
4. THE Mobile_UI SHALL 使用更粗更清晰的控件
5. THE Mobile_UI SHALL 减少重要按钮数量，保持稳定
6. THE Mobile_UI SHALL 采用卡片化的数据摘要
7. THE Mobile_UI SHALL iOS 版使用轻透明材质、卡片浮层、系统感强的设计
8. THE Mobile_UI SHALL Android 版适配 Material 3，支持动态颜色、清晰层级、自然运动曲线


#### 需求 49：移动端导航结构

**用户故事：** 作为移动端用户，我需要简洁的导航结构，以便快速访问核心功能。

**接受标准**

1. THE Mobile_Navigation SHALL 使用底部 4 个主入口：首页、项目、扫描、我的
2. THE Mobile_Navigation SHALL 在 App 首页内增加"练习"主卡
3. THE Mobile_Navigation SHALL 在教师版小程序首页内增加"课堂任务"卡组
4. THE Mobile_Navigation SHALL 保持底部导航稳定，不做零碎动作
5. THE Mobile_Navigation SHALL 遵循平台规范：iOS 使用 tab bar，Android 使用 bottom navigation
6. THE Mobile_Navigation SHALL 在当前标签页显示未读数量徽章

### 优先级 P0：移动端关键页面

#### 需求 50：移动端首页

**用户故事：** 作为移动端用户，我需要一个"继续页"而非信息堆叠页，以便快速找到下一步。

**接受标准**

1. THE Mobile_Home_Page SHALL 显示"继续上次项目"卡片，点击直达上次停下的位置
2. THE Mobile_Home_Page SHALL 提供"立即扫描"大按钮
3. THE Mobile_Home_Page SHALL 显示"最近导入"列表
4. THE Mobile_Home_Page SHALL 显示"今日待确认"摘要
5. THE Mobile_Home_Page SHALL 显示"课堂任务"或"练习任务"（根据用户角色）
6. THE Mobile_Home_Page SHALL 显示"收藏模板"快速入口
7. THE Mobile_Home_Page SHALL 支持下拉刷新同步最新数据


#### 需求 51：扫描页

**用户故事：** 作为移动端用户，我需要一个流畅的扫描流程，以便快速导入乐谱。

**接受标准**

1. THE Scan_Page SHALL 提供三个选项：拍照、相册、微信文件（小程序）
2. THE Scan_Page SHALL 显示相机取景框或文件选择界面
3. THE Scan_Page SHALL 提供自动检测开关、批量页拍摄、去阴影提示
4. THE Scan_Page SHALL 每拍完一页即显示缩略图
5. THE Scan_Page SHALL 支持拖动排序和删除某页重拍
6. THE Scan_Page SHALL 在完成后显示"正在识别第 X/Y 页"进度
7. THE Scan_Page SHALL 在检测到低质量图片时提示调整拍摄角度或光线
8. THE Scan_Page SHALL 支持实时边缘检测和自动裁切

#### 需求 52：移动端项目页

**用户故事：** 作为移动端用户，我需要一个"移动可继续"的项目面板，以便管理我的作品。

**接受标准**

1. THE Mobile_Project_Page SHALL 以卡片形式显示项目，包含缩略图、标题、状态
2. THE Mobile_Project_Page SHALL 显示最近状态、低置信数量、是否已导出、是否待课堂反馈
3. THE Mobile_Project_Page SHALL 支持按状态、时间、难度筛选
4. THE Mobile_Project_Page SHALL 支持长按进入多选模式，批量操作
5. THE Mobile_Project_Page SHALL 支持左滑快捷操作：分享、删除、归档
6. THE Mobile_Project_Page SHALL 显示项目同步状态（已同步/同步中/冲突）


#### 需求 53：移动端结果页

**用户故事：** 作为移动端用户，我需要先看到摘要再看细节，以便快速判断结果质量。

**接受标准**

1. THE Mobile_Result_Page SHALL 首屏显示摘要卡：调性、推荐难度、低置信处数量、一键播放、一键导出/分享
2. THE Mobile_Result_Page SHALL 提供可滑动的缩略谱面预览
3. THE Mobile_Result_Page SHALL 往下滑动显示完整谱面、简谱、和弦列表
4. THE Mobile_Result_Page SHALL 支持单击小节高亮并呼出底部候选卡
5. THE Mobile_Result_Page SHALL 支持双击播放该小节
6. THE Mobile_Result_Page SHALL 支持长按加入"稍后处理"
7. THE Mobile_Result_Page SHALL 支持双指缩放局部放大
8. THE Mobile_Result_Page SHALL 支持横向滑动切换上一/下一待确认小节

#### 需求 54：移动端快速修正页

**用户故事：** 作为移动端用户，我需要一个"移动 80 分修正"流程，以便快速处理常见问题。

**接受标准**

1. THE Mobile_Quick_Fix SHALL 点击小节后底部弹出候选和弦 sheet
2. THE Mobile_Quick_Fix SHALL 支持左右滑动查看替代方案
3. THE Mobile_Quick_Fix SHALL 支持上滑查看"为什么"解释
4. THE Mobile_Quick_Fix SHALL 确认后立即生效并自动跳转到下一个待确认小节
5. THE Mobile_Quick_Fix SHALL 显示修正进度：已确认 X/Y 处
6. THE Mobile_Quick_Fix SHALL 支持"跳过"和"稍后处理"
7. THE Mobile_Quick_Fix SHALL 在完成所有确认后显示庆祝动画和摘要


#### 需求 55：移动端我的/设置页

**用户故事：** 作为移动端用户，我需要一个个性化的设置页，以便系统越来越像"我的工具"。

**接受标准**

1. THE Mobile_Settings_Page SHALL 重点显示：默认难度、常用风格、常用导出格式、偏好解释粒度
2. THE Mobile_Settings_Page SHALL 显示班级/合作空间入口
3. THE Mobile_Settings_Page SHALL 显示最近收藏模板
4. THE Mobile_Settings_Page SHALL 显示账号信息和同步状态
5. THE Mobile_Settings_Page SHALL 提供"仅本次处理、不入库"开关
6. THE Mobile_Settings_Page SHALL 显示使用统计：本周分析曲数、修正次数、常用和声模板
7. THE Mobile_Settings_Page SHALL 提供清晰的隐私说明和数据管理入口

### 优先级 P1：移动端交互设计

#### 需求 56：移动端首次进入流程

**用户故事：** 作为新用户，我需要一个极简的首次进入流程，以便快速开始使用。

**接受标准**

1. THE Mobile_Onboarding SHALL 小程序首次进入显示三个大按钮：拍一页试试、从微信文件打开、看一首示例
2. THE Mobile_Onboarding SHALL App 首次进入询问角色：我是老师、我是学习者/创作者
3. THE Mobile_Onboarding SHALL 角色选择仅影响默认推荐，不封死功能
4. THE Mobile_Onboarding SHALL 避免使用轮播式新手教程
5. THE Mobile_Onboarding SHALL 在首次成功后轻提示关键功能位置
6. THE Mobile_Onboarding SHALL 支持跳过引导直接开始使用


#### 需求 57：扫描/导入交互

**用户故事：** 作为移动端用户，我需要一步一反馈的扫描流程，以便清楚地了解进度。

**接受标准**

1. THE Scan_Interaction SHALL 将扫描流程分成 4 个轻步骤：取图、识别页边、选择继续加页或完成、进入分析
2. THE Scan_Interaction SHALL 每拍完一页即出现缩略图
3. THE Scan_Interaction SHALL 支持拖动排序和删除某页重拍
4. THE Scan_Interaction SHALL 完成后显示"正在识别第 X/Y 页"
5. THE Scan_Interaction SHALL 在识别过程中显示阶段化进度
6. THE Scan_Interaction SHALL 支持取消长时间任务

#### 需求 58：Bottom Sheet 与全屏编辑分工

**用户故事：** 作为移动端用户，我需要清晰的界面层级，以便快速完成任务。

**接受标准**

1. THE Mobile_UI_Hierarchy SHALL 使用 bottom sheet 处理：快速替换和弦、查看理由、选择导出格式
2. THE Mobile_UI_Hierarchy SHALL 使用全屏页面处理：长时间审稿、连续多小节编辑、课堂批注
3. THE Mobile_UI_Hierarchy SHALL bottom sheet 支持拖动调整高度
4. THE Mobile_UI_Hierarchy SHALL bottom sheet 支持向下滑动关闭
5. THE Mobile_UI_Hierarchy SHALL 全屏页面提供明确的返回按钮
6. THE Mobile_UI_Hierarchy SHALL 遵循平台规范：iOS 使用 sheet，Android 使用 bottom sheet


#### 需求 59：练习与回看功能

**用户故事：** 作为 App 用户，我需要练习和回看功能，以便将分析结果转化为学习素材。

**接受标准**

1. THE Practice_Mode SHALL 支持自动播放当前和弦进行
2. THE Practice_Mode SHALL 跟随高亮当前小节
3. THE Practice_Mode SHALL 支持一键切换"只看和弦 / 只看简谱 / 只看功能"
4. THE Practice_Mode SHALL 支持收藏"这版我喜欢"
5. THE Practice_Mode SHALL 支持加入练习清单
6. THE Practice_Mode SHALL 支持调整播放速度
7. THE Practice_Mode SHALL 支持循环播放指定区域
8. THE Practice_Mode SHALL 记录练习历史和进度

#### 需求 60：小程序社交与课堂交互

**用户故事：** 作为小程序用户，我需要便捷的分享和协作功能，以便在微信生态中传播。

**接受标准**

1. THE MiniProgram_Social SHALL 生成可分享摘要卡，包含曲目信息和预览图
2. THE MiniProgram_Social SHALL 分享到群后，接收者可直接打开只读版
3. THE MiniProgram_Social SHALL 老师布置任务时生成作业链接
4. THE MiniProgram_Social SHALL 学生从链接直达对应曲目与说明
5. THE MiniProgram_Social SHALL 支持"我已确认/我有疑问"轻反馈
6. THE MiniProgram_Social SHALL 支持群内快速讨论和评论
7. THE MiniProgram_Social SHALL 老师可查看学生打开和完成状态


#### 需求 61：权限与隐私设计

**用户故事：** 作为移动端用户，我需要透明的权限管理和隐私保护，以便信任系统。

**接受标准**

1. THE Privacy_Design SHALL 采用"临门一脚再申请"策略，不在进入时要求所有权限
2. THE Privacy_Design SHALL 用户点"拍照"时再请求相机权限
3. THE Privacy_Design SHALL 用户点"从相册导入"时再请求相册权限
4. THE Privacy_Design SHALL 首次上传前弹出极简说明卡：上传内容、用途、保存规则、是否可删除
5. THE Privacy_Design SHALL 提供"仅本次处理、不入库"显式开关
6. THE Privacy_Design SHALL 在设置中提供清晰的隐私说明和数据管理入口
7. THE Privacy_Design SHALL 支持用户查看和删除所有上传数据
8. THE Privacy_Design SHALL 遵守平台隐私规范和最小权限原则

### 优先级 P2：跨端协同与依赖性机制

#### 需求 62：跨端无缝继续

**用户故事：** 作为用户，我需要在不同设备间无缝切换，以便灵活使用系统。

**接受标准**

1. THE Cross_Platform_Sync SHALL 实时同步项目数据、修正历史、偏好设置
2. THE Cross_Platform_Sync SHALL 记住用户在每个端的上次位置
3. THE Cross_Platform_Sync SHALL 支持"手机上拍，Web 端深修"的工作流
4. THE Cross_Platform_Sync SHALL 支持"Web 导出前，手机上快速复核"的工作流
5. THE Cross_Platform_Sync SHALL 在检测到冲突时提供版本选择
6. THE Cross_Platform_Sync SHALL 显示同步状态和最后同步时间
7. THE Cross_Platform_Sync SHALL 支持离线编辑，联网后自动同步


#### 需求 63：形成依赖性的机制

**用户故事：** 作为产品设计者，我需要建立多层依赖性机制，以便用户长期使用系统。

**接受标准**

1. THE Dependency_Mechanism SHALL 实现"继续未完成确认"：自动把用户带回上次没处理完的低置信小节
2. THE Dependency_Mechanism SHALL 实现"个人风格记忆"：系统记住用户常接受的和声色彩和解释深度
3. THE Dependency_Mechanism SHALL 实现"移动收藏夹"：常用伴奏模板、课堂例题、满意版本一键收藏
4. THE Dependency_Mechanism SHALL 实现"练习清单"：把分析结果自然转成练习素材
5. THE Dependency_Mechanism SHALL 实现"课堂提醒"：老师有新批注、学生有新提交时推送相关通知
6. THE Dependency_Mechanism SHALL 实现"周复盘"：每周自动汇总本周分析曲数、修正问题、常用模板
7. THE Dependency_Mechanism SHALL 实现"最近继续"：Web 端永远把用户拉回上次停下的小节
8. THE Dependency_Mechanism SHALL 实现"风格记忆"：记住用户常接受的和声倾向
9. THE Dependency_Mechanism SHALL 实现"模板复用"：常用模板一键套用
10. THE Dependency_Mechanism SHALL 实现"课堂沉淀"：班级库、学生作业、反馈痕迹都沉在系统里
11. THE Dependency_Mechanism SHALL 实现"版本资产化"：每次修正都成为可回看的知识节点
12. THE Dependency_Mechanism SHALL 实现"全局搜索"：可按曲名、调性、和弦、老师备注、学生名检索

---

## 总结

本需求文档覆盖了 MeloChord 从 MVP 到商业产品的全面升级，包括：

**后端核心（需求 1-30）**：
- 核心架构升级（候选格、全局解码、LLM 重定位）
- 和声节奏独立建模
- RAG 检索升级
- 调性分析升级
- 验证器升级为修复器
- 难度系统升级
- IR 表示层增强
- Parser 层补强
- MusicXML 输出升级
- 调式统一
- 风格控制系统
- OMR 误差吸收
- 用户编辑闭环
- 多候选输出
- 评测基准
- 置信度标定
- 解释层构建
- 性能优化
- 小型模型蒸馏
- 法律合规

**Web 端（需求 31-46）**：
- 三栏式工作台
- 视觉系统
- 关键页面（首页、导入、工作台、审核、项目库、课堂）
- 组件系统
- 交互设计（首次使用、进度反馈、非线性工作流、解释系统、不确定性可视化、导出分享）

**移动端（需求 47-63）**：
- 双端定位
- 视觉系统
- 关键页面（首页、扫描、项目、结果、快速修正、设置）
- 交互设计（首次进入、扫描流程、UI 层级、练习回看、社交协作、权限隐私）
- 跨端协同
- 依赖性机制

共计 **63 个需求**，全面覆盖从技术深度到产品体验的完整升级路径。

