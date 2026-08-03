# Aesthetic Archive｜产品 PRD 与 UI 设计标准 v0.1

> 产品名称：Aesthetic Archive  
> 产品定位：给设计师的 AI 审美体系知识库  
> 当前阶段：Open Beta / MVP 规划  
> 目标用户：空间 / 景观设计师、平面 / 品牌设计师、AI 视觉创作者、设计学生、小型设计工作室  
> 文档目的：统一产品定位、核心功能、页面结构、功能页交互与 UI 设计标准，作为后续逐步制作的依据。

---

## 1. 产品一句话定位

**Aesthetic Archive 是一个面向设计师的 AI 审美体系知识库，帮助用户搜索、搭建和复用自己的视觉风格生产资料。**

更完整表达：

**Aesthetic Archive 帮助设计师把视觉参考转化为可搜索、可解释、可生成、可导出的审美生产资料，包括风格文化背景、设计元素、主色系、构图类型和中英文 Prompt。**

英文表达：

**Aesthetic Archive is an AI-powered aesthetic knowledge base for designers to search, build, and reuse visual style systems.**

---

## 2. 产品核心价值

Aesthetic Archive 不应被理解为普通图库、Moodboard 工具或 Prompt 平台。它的核心价值是：

> 把视觉参考从“图片收藏”转化为“可复用的审美生产资料”。

### 2.1 解决的问题

| 问题 | 用户现状 | Aesthetic Archive 的解决方式 |
|---|---|---|
| 参考图越存越多，但难以复用 | 图片散落在 Pinterest、Eagle、相册、聊天记录、项目文件夹 | 统一沉淀为可搜索的审美知识库 |
| 看得懂感觉，但说不清结构 | “高级、克制、有氛围”很难转成明确语言 | 提取风格背景、设计元素、色彩、构图 |
| Prompt 每次都重写 | AI 生图缺少稳定变量和负向约束 | 生成中英文 Prompt 与 Negative Prompt |
| Moodboard 停留在展示 | 拼贴图只能沟通氛围，不能沉淀资料 | Collage 可标注、导出、总结、未来生成新图 |

---

## 3. 目标用户

| 用户 | 高频任务 | 产品价值 |
|---|---|---|
| 空间 / 景观设计师 | 项目前期参考、材料语言、方案汇报 | 把空间参考转为风格结构、构图、提案语言和 Prompt |
| 平面 / 品牌设计师 | 视觉系统、版式语气、品牌 moodboard | 沉淀版式、色彩、视觉元素和 Prompt Pack |
| AI 视觉创作者 | 稳定生成某种视觉风格 | 复用双语 Prompt、风格变量和负向约束 |
| 设计学生 / 转行者 | 学习案例拆解、建立审美体系 | 学习风格来源、设计元素和构图逻辑 |
| 小型设计工作室 | 团队内部风格资料沉淀 | 建立私有审美库和项目风格资产 |

---

## 4. 核心产品模块

### 4.1 视觉库广场 / Public Plaza

公共审美案例浏览与搜索区。

用户可以：

- 搜索公开审美案例。
- 按分类、风格、色系、构图、用途筛选。
- 查看风格图册和审美资料。
- 复制 Prompt。
- 收藏案例。
- 加入 Collage 画板。

### 4.2 个人审美库 / My Archive

用户自己的私有审美知识库。

用户可以：

- 上传参考图。
- 粘贴图片或项目 URL。
- 手动创建审美条目。
- 接入自定义 AI Provider 后，生成图生文分析。
- 编辑风格文化背景、设计元素、主色系、构图类型、Prompt。
- 设置条目为私有或公开。
- 导出 Prompt Pack / Markdown / JSON。

### 4.3 个人收藏 / Saved

用户从公共广场或其他位置保存的案例。

用户可以：

- 查看收藏案例。
- 按项目或标签分组。
- 添加私人备注。
- 加入 Collage。
- 批量导出。

### 4.4 Collage 画板 / Collage Board

视觉拼贴、标注和风格整理工具。

早期能力：

- 图片拼贴。
- 简单拖拽布局。
- 文字标注。
- 涂鸦 / 框选 / 便签。
- 基础导出。

未来能力：

- AI 总结画板风格。
- 从画板生成 Prompt Pack。
- 文生图 / 图生图。
- 高清导出、PDF 导出、多画板、图层管理。

### 4.5 AI Provider

早期开放版本支持用户自定义 AI Provider。

用户可以配置：

- Provider 类型：OpenAI / Gemini / OpenRouter / Custom Endpoint。
- API Key。
- Base URL。
- Vision Model。
- Text Model。
- Key 存储策略：默认本地浏览器。
- Test Connection。

### 4.6 个人设置 / Settings

包括：

- 账号信息。
- 默认语言：中文 / English / 双语。
- 默认导出格式：Markdown / JSON / PDF。
- Prompt 偏好：Midjourney / SD / GPT Image / 通用英文。
- 隐私设置。
- 图片版权提醒。
- 数据导出 / 删除。

---

## 5. 审美条目数据结构

每一个审美案例 / Style Case 应包含以下字段：

```json
{
  "id": "AA-001",
  "title": "Quiet Oriental Entrance",
  "titleZh": "东方克制住宅入口",
  "category": "Architecture",
  "subCategory": "Landscape / Entrance",
  "visibility": "public | private",
  "sourceType": "public-reference | user-uploaded | self-curated | licensed",
  "sourceNote": "Educational reference; replace with licensed assets before commercial use.",
  "gallery": ["image-1.jpg", "image-2.jpg", "image-3.jpg"],
  "coverImage": "cover.jpg",
  "culturalBackground": "东方克制、侘寂与现代高端住宅入口空间语言的结合。",
  "designElements": ["stone", "moss", "negative space", "hidden water feature"],
  "palette": ["#D8D1C4", "#8A8378", "#3E403A", "#EEE9DF"],
  "compositionType": "Axial composition / negative space / low horizon",
  "styleTags": ["quiet oriental", "wabi-sabi", "low saturation"],
  "materialTags": ["stone", "moss", "gravel", "wood"],
  "scenarioTags": ["residential entrance", "courtyard", "hotel entrance", "AI image generation"],
  "promptZh": "生成一个东方克制的高端住宅入口空间，低饱和色调，石材、苔藓和留白构图……",
  "promptEn": "Create a quiet oriental high-end residential entrance with low-saturation palette, stone, moss and negative space...",
  "negativePrompt": "avoid red lanterns, symbolic Chinese clichés, excessive ornamentation",
  "reviewStatus": "ai-generated | human-reviewed | draft",
  "createdAt": "YYYY-MM-DD",
  "updatedAt": "YYYY-MM-DD"
}
```

---

## 6. 宣传页结构

宣传页整体参考 mymind 的气质：克制、留白、抽象但明确，不一开始堆功能，而是先传达“审美系统”的产品概念。

### Section 1｜Hero

主标题：

**别再只是收藏参考图，开始搭建你的审美知识库。**

副标题：

Aesthetic Archive 帮助设计师把视觉参考转化为可搜索、可解释、可生成、可导出的审美生产资料：风格文化背景、设计元素、主色系、构图类型和中英文 Prompt。

CTA：

- Explore Plaza
- Build My Archive
- Connect AI Provider

右侧展示一张审美知识卡片，包含：

- 风格名称。
- Cultural Background。
- Design Elements。
- Palette。
- Composition。
- Prompt ZH。
- Prompt EN。

### Section 2｜快速进入产品

标题：

**从广场搜索，或搭建你自己的审美库。**

三张入口卡片：

1. 视觉库广场 / Public Plaza  
   搜索公开审美案例，按风格、色彩、构图、场景和 Prompt 筛选。  
   标记：Open Beta。

2. 个人审美库 / My Archive  
   上传参考图，生成风格背景、设计元素、色卡、构图和中英文 Prompt。  
   标记：Custom AI Provider。

3. Collage 画板 / Collage Board  
   拼贴、涂鸦、标注，整理成项目风格板。  
   标记：Open Beta。

### Section 3｜痛点

标题：

**参考图越存越多，真正能复用的审美资料却很少。**

痛点卡片：

- 收藏很多，但找不到。
- 看得懂感觉，说不清结构。
- Prompt 每次都重试。

### Section 4｜解决方案

标题：

**把每张参考图变成一个可复用的审美模块。**

展示 Before / After：

Before：一张参考图，“想要这种感觉”，没有结构，下次项目重新理解。  
After：一个审美知识模块，包含文化背景、设计元素、主色系、构图类型、适用场景、中英文 Prompt 和负向约束。

### Section 5｜产品如何工作

标题：

**从视觉参考到审美生产资料，只需要三步。**

步骤：

1. Search or Upload：在视觉库广场搜索，或上传自己的参考图。
2. Extract Aesthetic Structure：手动编辑，或接入 AI Provider 生成结构化资料。
3. Reuse Everywhere：收藏、加入 Collage、导出 Prompt Pack，用于提案、AI 生图和项目资料沉淀。

### Section 6｜功能预览

展示 App Shell：

- 左侧 Sidebar。
- 主区域搜索框。
- 筛选器。
- 卡片网格。

### Section 7｜卡片详情交互展示

展示点击卡片后的详情面板：

- 左侧：Style Gallery。
- 右侧：Aesthetic Knowledge + Prompt。

### Section 8｜适合谁

用户卡片：

- 空间 / 景观设计师。
- 平面 / 品牌设计师。
- AI 视觉创作者。
- 设计学生 / 转行者。
- 小型设计工作室。

### Section 9｜与普通收藏工具的区别

标题：

**不是图库，是可复用的审美生产资料库。**

对比：

| 普通收藏工具 | Aesthetic Archive |
|---|---|
| 保存图片 | 提取审美结构 |
| 文件夹 / 标签整理 | 风格文化背景 + 设计元素 |
| 只能看图 | 可生成中英文 Prompt |
| 每次项目重新理解 | 沉淀为个人审美库 |
| moodboard 停留在展示 | Collage 可标注、导出、分析 |
| 灵感碎片 | 可复用生产资料 |

### Section 10｜Final CTA

标题：

**开始搭建你的审美知识库。**

文案：

从搜索一个风格开始，或者上传你的第一张参考图。早期开放版本支持自定义 AI Provider，适合设计师先免费试用和验证工作流。

CTA：

- Explore Plaza
- Build My Archive
- Connect AI Provider

---

## 7. 功能页信息架构

### 7.1 页面总结构

```text
/app

Sidebar
  - 视觉库广场
  - 个人审美库
  - 个人收藏
  - Collage 画板
  - AI Provider
  - 个人设置

Main
  - Search bar
  - Filter chips
  - Card grid
  - Flip-inspired detail panel
```

### 7.2 左侧栏

```text
Aesthetic Archive

▣ 视觉库广场
  Public Plaza

▣ 个人审美库
  My Archive

▣ 个人收藏
  Saved

▣ Collage 画板
  Collage Board

▣ AI Provider
  Connect your own API

▣ 个人设置
  Settings
```

早期不把 Get Pro 放入主导航，避免过早商业化。后续验证使用意愿后再加入 Pro / Hosted AI / Team 方案。

### 7.3 主区域

主区域以搜索、筛选和卡片网格为核心，不做复杂 dashboard。

顶部搜索示例：

```text
Search aesthetic systems...

例如：
东方克制住宅入口
Swiss editorial grid
低饱和石材庭院
dark cinematic brand visual
Art Deco luxury poster
```

筛选器：

```text
Category
[All] [Architecture] [Interior] [Landscape] [Graphic] [Branding] [AI Visual]

Style
[Minimal] [Brutalist] [Wabi-sabi] [Swiss] [Art Deco] [Editorial] [Cinematic]

Palette
[Neutral] [Warm] [Cold] [Dark] [High Contrast] [Earth Tone]

Composition
[Grid] [Axial] [Centered] [Asymmetric] [Collage] [Low Horizon] [Close-up]

Output
[Prompt Available] [Gallery] [Cultural Background] [Exportable]
```

---

## 8. 卡片设计标准

### 8.1 卡片正面

卡片用于快速浏览，必须简洁、信息密度适中。

包含：

- Cover Image。
- 英文标题。
- 中文标题。
- 主色卡。
- 2–4 个标签。
- 构图类型。
- Save 按钮。
- Add to Collage 按钮。

结构示例：

```text
┌────────────────────────┐
│ [Cover Image]          │
│                        │
│ Quiet Oriental Entrance│
│ 东方克制住宅入口        │
│                        │
│ ● ● ● ●                │
│ Oriental / Stone       │
│ Axial Composition      │
│                        │
│ [Save] [+ Collage]     │
└────────────────────────┘
```

### 8.2 卡片点击交互

采用方案 B：**Flip-inspired Detail Panel**。

交互流程：

```text
用户点击卡片
  ↓
卡片轻微放大 / 翻转感过渡
  ↓
背景网格弱化 / 模糊 / 降低亮度
  ↓
中央弹出详情面板
  ↓
左侧 Style Gallery，右侧 Aesthetic Knowledge + Prompt
```

### 8.3 详情面板布局

详情面板采用左右分栏。

左侧：Style Gallery。

- Main Image。
- Thumbnail gallery。
- Gallery Notes。
- Add Gallery to Collage。

右侧：Aesthetic Knowledge。

- Cultural Background。
- Design Elements。
- Palette。
- Composition Type。
- Use Cases。
- Prompt ZH。
- Prompt EN。
- Negative Prompt。
- Save。
- Add to Collage。
- Export。

结构示例：

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Quiet Oriental Entrance                                             [X]      │
│ 东方克制住宅入口                                                             │
│                                                                              │
│ ┌──────────────────────────────┐ ┌─────────────────────────────────────────┐ │
│ │ LEFT                         │ │ RIGHT                                   │ │
│ │ Style Gallery                │ │ Aesthetic Knowledge                     │ │
│ │                              │ │                                         │ │
│ │ [Main Image]                 │ │ Cultural Background                     │ │
│ │                              │ │ Design Elements                         │ │
│ │ [Thumb] [Thumb] [Thumb]      │ │ Palette                                 │ │
│ │                              │ │ Composition Type                        │ │
│ │ Gallery Notes                │ │ Use Cases                               │ │
│ │                              │ │ Prompt ZH + Copy                        │ │
│ │ [Add Gallery to Collage]     │ │ Prompt EN + Copy                        │ │
│ │                              │ │ Negative Prompt                         │ │
│ │                              │ │ [Save] [Add to Collage] [Export]         │ │
│ └──────────────────────────────┘ └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. UI 设计标准

### 9.1 设计气质

关键词：

- 克制。
- 高级留白。
- 私人知识库。
- 视觉档案。
- 轻微纸感 / 博物馆感。
- 不做重 SaaS 后台感。
- 不做过度科技感。

参考方向：

- 宣传页参考 mymind：留白、抽象叙事、轻柔交互、少量大标题。
- 功能页参考 Landingfolio：搜索筛选清晰、卡片网格密集、浏览效率高。

### 9.2 颜色

建议基础色系：

```text
Background: #F6F2EA / #F8F5EF
Surface:    #FFFFFF / #F1ECE4
Text Main:  #171512
Text Sub:   #6F675D
Border:     #DDD3C7
Accent:     #1E1B16 或 #8A6F4D
Muted:      #B8AFA3
```

原则：

- 页面整体应偏暖白 / 米白。
- 不使用过强蓝紫科技渐变。
- Prompt 区可以使用轻微代码块质感。
- 色卡本身是视觉重点，UI 不应抢色。

### 9.3 字体

建议：

- 中文：系统黑体 / 思源黑体 / Noto Sans SC。
- 英文标题：Inter / Neue Haas Grotesk / system sans。
- 可少量使用 serif 增加档案感，但不要牺牲可读性。

字号建议：

```text
Hero H1: 56–72px desktop, 36–44px mobile
Section H2: 36–48px desktop, 28–34px mobile
Card Title: 16–20px
Body: 15–17px
Caption: 12–13px
```

### 9.4 布局

宣传页：

- 大留白。
- 分屏 Hero。
- 大标题 + 少量说明。
- 卡片示意不宜太多。
- CTA 尽量前置。

功能页：

- 左侧栏固定。
- 主区域顶部固定搜索感。
- 卡片网格为主体。
- 不做复杂仪表盘。
- 详情通过弹出面板承载，不跳转破坏浏览流。

### 9.5 卡片视觉

卡片风格：

- 圆角中等：16–24px。
- 轻边框。
- 微阴影。
- 图片比例建议 4:3 或 3:2。
- 色卡靠近标题或标签区域。
- hover 时轻微上浮，不做夸张动画。

### 9.6 动效

动效原则：

- 轻、慢、克制。
- 强调“打开资料卡”的感觉。
- 不要游戏化。

建议：

- 卡片 hover：translateY(-4px)，shadow 增强。
- 打开详情：scale + opacity + slight rotateY，营造翻转感。
- 背景网格：blur 或 dim。
- 面板关闭：反向过渡。

### 9.7 响应式

Desktop：

- Sidebar + Main。
- 卡片 3–4 列。
- 详情面板左右分栏。

Tablet：

- Sidebar 可折叠。
- 卡片 2–3 列。
- 详情面板左右仍可保留，但压缩 Gallery。

Mobile：

- Sidebar 变底部导航或抽屉。
- 卡片 1 列。
- 详情面板上下结构：Gallery 在上，内容在下。

---

## 10. AI Provider 早期策略

### 10.1 产品策略

早期做开放版本：

- 免费开放一段时间。
- 用户可以浏览、收藏、手动搭建审美库。
- 用户可以自定义 AI Provider，启用智能分析。
- 暂不细分复杂套餐。
- 暂不承担平台托管 API 成本。

### 10.2 用户文案

```text
Connect your own AI Provider.

Aesthetic Archive 默认支持手动整理和浏览审美资料。
如果你希望自动分析图片、生成中英文 Prompt 或总结 Collage，
可以在本地接入自己的 AI Provider。

早期版本不会托管你的 API Key。
你可以使用 OpenAI、Gemini、OpenRouter 或自定义兼容接口。
```

### 10.3 AI Provider 设置页

```text
AI Provider

Provider Type
[OpenAI] [Gemini] [OpenRouter] [Custom Endpoint]

API Key
[________________________________]

Base URL
[________________________________]
仅 Custom Endpoint 需要

Vision Model
[________________________________]
用于图片分析

Text Model
[________________________________]
用于 Prompt 生成和总结

Key Storage
[Local browser only]

[Test Connection]   [Save]
```

### 10.4 早期 AI 能力

一个 AI Provider 设置支撑三类能力：

1. 图片分析：用于 My Archive。
2. Prompt 生成：用于 Plaza / My Archive / Saved。
3. Collage Summary：用于 Collage 画板。

---

## 11. MVP 验收标准

### 宣传页

- 用户 30 秒内理解产品不是图库，而是审美知识库。
- Hero 使用明确标题：“别再只是收藏参考图，开始搭建你的审美知识库。”
- CTA 前置，能快速进入 Plaza / My Archive / AI Provider。
- 页面展示审美知识模块的字段结构。

### 功能页

- 左侧栏包含：视觉库广场、个人审美库、个人收藏、Collage 画板、AI Provider、个人设置。
- 主区域以搜索 / 筛选 / 卡片网格为主。
- 点击卡片后出现详情面板。
- 详情面板左侧为 Style Gallery，右侧为风格资料与 Prompt。
- 支持保存、加入 Collage、复制 Prompt。

### AI Provider

- 用户可看到自定义 AI Provider 的设置入口。
- 早期可先做 UI mock，不强制真实调用。
- 文案明确：Open Beta、免费体验、自定义接入。

---

## 12. 当前阶段产品原则

1. 先让用户理解“审美知识库”，再讲 AI。
2. 不过早强调收费，避免还没验证就制造阻力。
3. 功能页以浏览效率为第一目标，卡片网格优先。
4. 详情信息通过弹出面板承载，保持探索流不断。
5. AI Provider 早期做开放接入，不承担平台 API 成本。
6. Collage 是未来差异化重点，但早期可先做轻量原型。
7. 所有 AI 输出都应保留人工复核和版权边界提示。
