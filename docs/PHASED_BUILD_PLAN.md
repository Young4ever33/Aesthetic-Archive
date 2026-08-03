# Aesthetic Archive｜分期制作计划 v0.1

> 产品定位：给设计师的 AI 审美体系知识库  
> 当前策略：Open Beta，先免费开放一段时间，支持用户自定义 AI Provider；收费细分后置。  
> 计划目的：把设计、功能、API 接入、收费计划拆分为可逐步执行的阶段。

---

## 1. 总体制作路线

```text
Phase 0  定位与文档收束
Phase 1  宣传页改版
Phase 2  功能页 App Shell 与卡片网格
Phase 3  卡片详情面板与 Prompt 复用
Phase 4  个人审美库与手动创建流程
Phase 5  AI Provider 自定义接入
Phase 6  Collage 画板轻量原型
Phase 7  Open Beta 用户测试与反馈闭环
Phase 8  商业化与 Hosted AI 方案设计
Phase 9  高级 AI 与团队能力
```

---

## Phase 0｜定位与文档收束

### 目标

把当前已明确的产品方向、PRD、UI 标准和分期计划固化，作为后续执行依据。

### 设计任务

- 明确产品名：Aesthetic Archive。
- 明确核心定位：给设计师的 AI 审美体系知识库。
- 明确 Hero 文案。
- 明确宣传页结构。
- 明确功能页结构。
- 明确卡片详情交互方案。

### 功能任务

- 确定左侧栏模块：
  - 视觉库广场。
  - 个人审美库。
  - 个人收藏。
  - Collage 画板。
  - AI Provider。
  - 个人设置。
- 确定主区域交互：搜索 / 筛选 / 卡片网格。
- 确定点击卡片打开左右分栏详情面板。

### API 任务

- 确定早期不做平台托管 API。
- 确定支持用户自定义 AI Provider。
- 确定 AI Provider 未来支持：图片分析、Prompt 生成、Collage Summary。

### 收费任务

- 确定早期 Open Beta 免费。
- 暂不设置复杂套餐。
- 未来再根据使用数据设计 Hosted AI / Pro / Team。

### 产出

- `docs/PRODUCT_PRD_UI_STANDARD.md`
- `docs/PHASED_BUILD_PLAN.md`

### 验收

- 文档完整。
- 后续制作可直接按阶段执行。

---

## Phase 1｜宣传页改版

### 目标

把当前首页从“AI Design Reference OS Demo”改成更明确的“审美知识库”宣传页。

### 设计任务

- 参考 mymind 的宣传气质：克制、留白、抽象但明确。
- Hero 使用：

```text
别再只是收藏参考图，开始搭建你的审美知识库。
```

- 首屏右侧展示审美知识卡片。
- Section 2 前置三个入口卡片：
  - Public Plaza。
  - My Archive。
  - Collage Board。
- 不放独立 Pricing / Get Pro 区块。
- 在 Final CTA 中轻量提及 Open Beta 和自定义 AI Provider。

### 功能任务

- 更新 `index.html` 页面结构。
- 更新首屏 CTA。
- 增加产品入口卡片。
- 增加“产品如何工作”三步说明。
- 增加“卡片详情交互展示”静态示意。

### API 任务

- 页面上只出现 `Connect AI Provider`。
- 不讲复杂 API 细节。
- 用 Open Beta 文案说明用户可自行接入。

### 收费任务

- 不展示套餐。
- 不展示价格。
- 不出现强付费墙。

### 产出

- 改版后的 `index.html`。
- 改版后的 `styles.css`。

### 验收

- 用户 30 秒内能理解：这是审美知识库，不是图库。
- CTA 在首屏和第二屏都能看到。
- 页面主叙事清晰：参考图 → 审美结构 → 可复用生产资料。

---

## Phase 2｜功能页 App Shell 与卡片网格

### 目标

建立真正的功能页壳：左侧栏 + 搜索筛选 + 卡片网格。

### 设计任务

- 参考 Landingfolio 的浏览效率。
- 左侧栏固定。
- 主区域以搜索和卡片网格为主。
- 不做复杂 dashboard。
- 卡片保持高视觉质量和清晰信息层级。

### 功能任务

- 新建或改造 `/app` 区域。
- 实现 Sidebar tab 切换：
  - Public Plaza。
  - My Archive。
  - Saved。
  - Collage Board。
  - AI Provider。
  - Settings。
- 实现搜索框。
- 实现筛选 chips：
  - Category。
  - Style。
  - Palette。
  - Composition。
  - Output。
- 实现卡片网格。
- 复用现有 22 个案例数据。

### API 任务

- 暂无真实 API。
- 数据仍可来自本地 JSON / JS seed data。

### 收费任务

- 暂无收费。
- 保持 Open Beta。

### 产出

- App Shell UI。
- 卡片网格。
- 搜索和基础筛选。

### 验收

- 左侧栏模块完整。
- 主区域可以浏览所有案例。
- 搜索和筛选可以改变卡片结果。
- 移动端至少可读。

---

## Phase 3｜卡片详情面板与 Prompt 复用

### 目标

实现点击卡片后弹出详情面板，左侧 Style Gallery，右侧风格知识与 Prompt。

### 设计任务

- 交互采用 Flip-inspired Detail Panel。
- 背景网格弱化 / 模糊 / 降低亮度。
- 面板左右分栏：
  - 左侧 Style Gallery。
  - 右侧 Aesthetic Knowledge + Prompt。
- 动效克制，不做夸张翻转。

### 功能任务

- 点击卡片打开详情面板。
- 详情面板展示：
  - Gallery。
  - Cultural Background。
  - Design Elements。
  - Palette。
  - Composition Type。
  - Use Cases。
  - Prompt ZH。
  - Prompt EN。
  - Negative Prompt。
- 实现 Copy ZH。
- 实现 Copy EN。
- 实现 Save。
- 实现 Add to Collage 的占位或基础逻辑。
- 实现 Export 的基础逻辑。

### API 任务

- 暂无真实 API。
- Prompt 使用 seed data。

### 收费任务

- 暂无收费。

### 产出

- 卡片详情弹窗。
- Prompt 复制功能。
- 收藏功能。

### 验收

- 点击卡片不跳转页面。
- 详情面板左图右文。
- Prompt 可复制。
- 关闭后回到原网格浏览流。

---

## Phase 4｜个人审美库与手动创建流程

### 目标

让用户可以先不依赖 AI，手动搭建自己的审美库。

### 设计任务

- My Archive 页面保留卡片网格。
- 顶部增加：
  - Upload Reference。
  - New Style Case。
  - Import URL。
- 条目状态清晰：Draft / AI-generated / Human-reviewed / Private / Public。

### 功能任务

- 新建审美条目表单。
- 上传图片本地预览。
- 手动填写字段：
  - 风格名称。
  - 风格文化背景。
  - 设计元素。
  - 主色系。
  - 构图类型。
  - 中文 Prompt。
  - English Prompt。
  - Negative Prompt。
- 保存到 localStorage。
- My Archive 卡片网格读取本地条目。
- 支持编辑和删除本地条目。

### API 任务

- 暂无真实 AI 调用。
- 为后续 AI Provider 预留按钮：Analyze with AI。

### 收费任务

- 仍然免费。
- 可提示：Open Beta。

### 产出

- My Archive 手动创建流程。
- 本地私有审美库。

### 验收

- 用户可以创建一条自己的审美案例。
- 刷新页面后数据仍存在。
- 用户可以编辑字段。
- 用户可以在 My Archive 中看到自己的卡片。

---

## Phase 5｜AI Provider 自定义接入

### 目标

允许用户使用自己的 API Key 启用 AI 分析能力。

### 设计任务

- AI Provider 设置页清晰易懂。
- 不暴露过多技术术语。
- 强调 Key 本地保存。
- 提供 Test Connection。

### 功能任务

- Provider Type：
  - OpenAI。
  - Gemini。
  - OpenRouter。
  - Custom Endpoint。
- 输入 API Key。
- 输入 Base URL。
- 输入 Vision Model。
- 输入 Text Model。
- 保存到 localStorage。
- 测试连接。
- 封装 AI Provider Adapter。

### API 任务

早期最小能力：

1. `analyzeReference(input)`
   - 输入图片 / URL / 用户目标。
   - 输出风格文化背景、设计元素、主色系、构图类型、Prompt。

2. `generatePrompt(input)`
   - 输入已有字段。
   - 输出中英文 Prompt 与 Negative Prompt。

3. `analyzeCollage(input)`
   - 输入画板图片和标注。
   - 输出画板总结和统一 Prompt。

### 收费任务

- 继续免费开放。
- 用户自备 API Key。
- 不承担平台 API 成本。

### 产出

- AI Provider 设置页。
- 本地 Provider 配置。
- 至少一个 Provider 的真实调用验证，或先做 mock adapter。

### 验收

- 用户可以保存自己的 Provider 设置。
- 用户可以测试连接。
- My Archive 中可点击 Analyze with AI。
- 至少能生成结构化 JSON 草稿，或在 mock 模式下表现一致。

---

## Phase 6｜Collage 画板轻量原型

### 目标

实现 Collage 的最小可用画板，让用户把审美案例组合成项目风格板。

### 设计任务

- Collage 列表页仍然使用卡片网格。
- 点击画板进入编辑器。
- 编辑器结构：
  - 左侧素材栏。
  - 中间画布。
  - 右侧属性 / 标注 / 导出面板。

### 功能任务

- 新建 Collage Board。
- 从 Plaza / My Archive / Saved 加入图片。
- 图片拖拽布局。
- 图片缩放。
- 添加文本标注。
- 添加简单便签。
- 基础导出 PNG。
- 保存画板到 localStorage。

### API 任务

- 如果 Phase 5 已完成，则增加 Analyze Collage。
- 否则先做 mock summary。

### 收费任务

- 仍然 Open Beta。
- 暂不限制功能。
- 记录哪些功能未来可能成为 Pro：高清导出、PDF、多画板、AI Summary、文生图。

### 产出

- Collage Board MVP。

### 验收

- 用户可以创建一个画板。
- 用户可以向画板添加图片。
- 用户可以添加标注。
- 用户可以保存并再次打开。

---

## Phase 7｜Open Beta 用户测试与反馈闭环

### 目标

验证真实设计师是否理解并愿意使用这个工作流。

### 设计任务

- 增加轻量反馈入口。
- 不干扰主流程。
- 提供 Bad Case 记录模板。

### 功能任务

- Useful / Not Useful。
- Feedback note。
- Bad Case log。
- Waitlist 或 Open Beta signup。
- 简单导出反馈记录。

### API 任务

- 可先用 localStorage。
- 后续可接 Supabase / Airtable / Formspree。

### 收费任务

- 不收费。
- 观察用户是否愿意：
  - 上传自己的图。
  - 配置自己的 API。
  - 保存个人库。
  - 使用 Collage。
  - 导出 Prompt Pack。

### 产出

- 用户测试任务。
- 反馈记录。
- Bad Case 表。

### 验收

- 至少完成 3–5 名设计相关用户测试。
- 收集 5–10 条具体反馈。
- 记录 3 个以上 Bad Case。
- 明确下一轮优先级。

---

## Phase 8｜商业化与 Hosted AI 方案设计

### 目标

在 Open Beta 验证后，再设计收费策略，不提前制造使用阻力。

### 设计任务

- 增加 Pricing / Get Pro 页面。
- 保持轻量、透明。
- 说明 BYO API 与 Hosted AI 的区别。

### 功能任务

- Hosted AI 额度系统规划。
- 用户账户系统规划。
- 使用量统计。
- Pro 功能开关。

### API 任务

- 后端托管 API。
- API key 安全存储。
- Rate limit。
- Usage tracking。
- Error handling。

### 收费计划草案

#### Free / Open

- 浏览公共广场。
- 搜索公开案例。
- 收藏少量案例。
- 手动创建个人审美库。
- 基础 Collage。
- BYO API。

#### Pro Hosted AI

- 平台托管 AI 分析额度。
- 图生文风格分析。
- Prompt 生成。
- Collage Summary。
- 批量分析。
- 更多个人库容量。
- 高清导出。

#### Studio / Team

- 团队共享审美库。
- 私有风格系统。
- 项目级 Collection。
- 成员权限。
- 品牌 / 空间项目模板。
- Figma / Eagle / Notion 导入导出。

#### 数字产品补充

- Prompt Pack。
- Starter Kit。
- 审美库字段模板。
- Bad Case 复盘表。
- 设计案例拆解模板。

### 验收

- 收费点基于 Open Beta 反馈，而不是主观猜测。
- 不影响免费用户理解和试用核心价值。

---

## Phase 9｜高级 AI 与团队能力

### 目标

从个人工具扩展到专业工作流和小团队协作。

### 设计任务

- 团队空间。
- 项目审美库。
- 高级 Collage。
- AI 生成前置工作台。

### 功能任务

- 文生图。
- 图生图。
- Collage to Image。
- 多用户协作。
- 版本历史。
- 权限管理。
- Prompt Pack marketplace。
- 导入 Eagle / Notion / Figma。

### API 任务

- 生成图 API。
- 向量搜索 / Embedding。
- 私有知识库 RAG。
- 图片存储。
- 用户权限。

### 收费任务

- Team / Studio。
- API credits。
- Marketplace revenue share。
- 企业私有部署可能性。

### 验收

- 有明确付费用户需求后再进入。
- 不在早期 MVP 中承诺。

---

## 2. 推荐立即执行顺序

当前最适合的下一步：

```text
1. Phase 1：宣传页改版
2. Phase 2：功能页 App Shell 与卡片网格
3. Phase 3：卡片详情面板与 Prompt 复用
4. Phase 4：个人审美库手动创建
5. Phase 5：AI Provider 自定义接入
```

不要过早做：

- 完整收费系统。
- Hosted AI。
- 用户账户。
- 团队协作。
- 文生图 / 图生图。

---

## 3. 当前 MVP 的 Definition of Done

### 产品定位

- 页面明确表达：不是图库，是审美知识库。
- 用户知道它能把参考图变成文化背景、设计元素、色卡、构图和 Prompt。

### 宣传页

- Hero 完成。
- 快速入口前置。
- 痛点、解决方案、工作流程、功能预览完整。
- 不出现强收费。

### 功能页

- 左侧栏完整。
- 主区域卡片网格完整。
- 搜索和筛选可用。
- 点击卡片打开详情面板。
- 左侧 Style Gallery，右侧资料与 Prompt。

### 个人库

- 可手动创建条目。
- 可保存到本地。
- 可编辑和查看。

### AI Provider

- 有设置页。
- 可保存用户自定义配置。
- 至少 mock 或真实验证一个 AI 分析流程。

### Collage

- 至少有入口和基础原型。
- 能加入图片或展示未来交互。

---

## 4. 风险与控制

| 风险 | 影响 | 控制方式 |
|---|---|---|
| 产品范围过大 | 无法完成 MVP | 先做宣传页、卡片网格、详情面板 |
| 过早收费 | 用户还没理解价值就流失 | Open Beta 免费，自定义 AI Provider |
| API 成本不可控 | 运营压力 | 早期 BYO API，不托管 Key |
| Collage 复杂度高 | 开发周期变长 | 先做轻量原型，后做高级编辑 |
| AI 输出质量不稳 | 用户不信任 | 保留人工编辑、reviewStatus、Bad Case |
| 图片版权风险 | 商业化受限 | 标注来源，提醒使用授权素材 |

---

## 5. 后续工作方式

之后每次制作建议只推进一个阶段，遵循：

```text
确认阶段目标
  ↓
修改页面 / 数据 / 逻辑
  ↓
本地预览
  ↓
验收清单
  ↓
记录变更
  ↓
进入下一阶段
```

建议下一步直接开始：

> **Phase 1｜宣传页改版**

先把首页改成新的产品叙事，再继续做功能页 App Shell。
