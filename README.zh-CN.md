# Aesthetic Archive

[English README](README.md) · [在线产品](https://myaestheticarchive.com) · [评测证据](evals/README.md) · [AI 纠偏记录](docs/ai-correction-log.md)

> 将视觉参考转化为结构化、可解释、可复用的审美知识与 Prompt 资产。

![Aesthetic Archive 产品界面](docs/screenshots/marketing-what.png)

## 当前状态

| 项目 | 状态 |
|---|---|
| 产品阶段 | Public alpha |
| 在线产品 | 可访问 |
| 核心流程 | 参考 → 分析 → 可编辑卡片 → Prompt 复用 → 审核 |
| Prompt 评测 | 已记录 1 个 A-04 双语受控案例 |
| 评测覆盖 | 仅为案例级证据，其他领域待补 |
| 已知限制 | 图像工作流可能自行加入商业灯光或招牌 |

## 核心产品判断

设计师可以收藏成千上万张图片，却仍然无法保留“这张图为什么有效”的判断。Aesthetic Archive 把参考图视为证据：区分可见事实、解释、不确定性、设计变量、来源和权利信息，再把这些内容转化为可编辑的审美卡片与可复用的中英双语 Prompt。

它不是普通图片收藏夹，也不是一键生成图片工具，而是灵感和生产之间的知识层：

```text
视觉参考 → 理解 → 审美体系 → 生产方向
```

产品有三条明确边界：

- AI 输出必须可编辑，不能被当成最终事实。
- Prompt 质量必须通过受控候选和失败原因记录进行验证。
- 私人卡片默认私有，公开内容必须经过人工审核。

## 我完成的工作

这是一个由我独立负责、使用 AI coding agent 辅助实现的产品。我的工作包括问题定义、卡片知识模型、四阶段流程、Prompt 评测标准、隐私和审核边界、人工验收及发布决策。

| 产品判断 | 实现证据 |
|---|---|
| 将参考图变成可复用知识 | 结构化卡片、中英 Prompt、负向约束、来源和版权字段 |
| 保持生成过程可信 | 可编辑结果、Provider Gateway、使用记录、明确失败状态 |
| 验证 Prompt 质量 | 四维加权评分与 70% 单维最低门槛 |
| 保护私人研究 | Supabase RLS、工作区隔离、默认私有 |
| 阻止 AI 内容自动公开 | Reviewer/Admin 审核队列和记录 |

## 可复核证据

当前受控证据来自 A-04 参数化建筑案例。修订版将结构约束前移到正向 Prompt，同时保留负向限制。

| 版本 | 语言 | 最佳候选分数 | 解释 |
|---|---|---:|---|
| v3.0 | 中文 | 约 60% | 商业和幻想偏移，参数化特征弱 |
| v3.0 | 英文 | 79.0% | 结构较好，场景和连廊仍不稳定 |
| v3.1 | 中文 | 81.2% | 形体增强，仍出现商业灯光 |
| v3.1 | 英文 | 82.8% | 色彩、场景和双连廊更稳定 |

这些数字是单一受控案例中、经人工评分的最佳候选结果，不是自动准确率或项目整体平均值。评分规则、元数据缺口和限制见 [`evals/`](evals/README.md)。

![A-04 中文基线](docs/prompt-v3/validation/A-04/zh-v1-best.webp)
![A-04 中文修订版](docs/prompt-v3/validation/A-04/zh-v31-best.webp)

原始测试图片保留平台水印，仅用于展示真实评测过程，不作为已授权生产素材。

## AI 做错了什么

实现过程中反复出现同一条产品纪律：不能用“看起来合理”的结果替代真实失败。

- 未经单样本验证的提取链路重构在约 40 秒内被撤回，质量链路必须先通过代表性案例。
- Provider 调试曾在没有真实上游结果时被标记为“已解决”，因此建立了禁止本地编造 AI 结果兜底的规则。
- 账户隔离事故推动了更严格的 RLS 和工作区验收标准。
- 评分框架由 AI 协助结构化，但候选评分明确属于人工评分和案例级证据。

完整记录见 [`docs/ai-correction-log.md`](docs/ai-correction-log.md)。

## 核心流程

1. 收藏或上传视觉参考。
2. 选择分析模板，并通过已配置 Provider 生成。
3. 审核可见事实、解释、材质、色彩、构图和置信度。
4. 编辑卡片及中英文 Prompt。
5. 在生成工具中复用，或加入 Collage Board。
6. 保持私有，或提交到经过审核的 Public Plaza。

## 产品模块

- **Public Plaza：** 经审核的公开案例、检索、收藏和来源信息。
- **My Archive：** 私人生成、手工卡片、编辑和 Provider 配置。
- **Prompt 复用：** 中英双语 Prompt、Negative Prompt 和模板。
- **Collage Board：** 将参考、注释和项目方向组织在同一视觉工作区。
- **Review Queue：** 内容公开前由 Reviewer/Admin 验收。

![Public Plaza](docs/screenshots/public-plaza.png)
![私人档案](docs/screenshots/my-archive.png)
![Collage Board](docs/screenshots/collage-board.png)

## 已知限制

- 当前 Prompt 证据只覆盖 1 个案例，景观、室内和平面案例待补。
- A-04 历史评测的 Provider 和模型元数据未完整记录。
- 人工评分使流程可复核，但不代表客观通用指标。
- Provider 工作流仍可能加入未请求的灯光、招牌和场景元素。
- 商业发布前必须确认所有公开种子图片的再分发权利。
- 架构复杂度来自私人工作区、审核、Provider 密钥和公开内容之间的信任边界。

## 本地运行

要求：Node.js 20+ 和 pnpm。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

执行完整验收：

```bash
pnpm check
```

该命令检查种子 Prompt、工作区契约、Lint、类型、仓库安全和生产构建。关键框架与类型依赖已固定到 lockfile 实际解析版本。

## 技术基础

- `app/`：Next.js 页面、API、认证和产品界面。
- `lib/`：校验、Supabase 客户端、Provider vault、AI Gateway 和使用记录。
- `supabase/migrations/`：Schema、RLS、存储、审核和可观测性。
- `evals/`：Prompt 评分规则、数据集和结果。
- `docs/`：产品契约、部署、QA、决策与纠偏证据。

Provider Key 在服务端加密保存，不得进入浏览器存储、API 响应、日志、截图或 Git 历史。配置说明见 [`docs/ENVIRONMENT_TEMPLATE.md`](docs/ENVIRONMENT_TEMPLATE.md)。

## 许可证与素材

代码许可证见 [`LICENSE`](LICENSE)。代码许可不自动涵盖第三方参考图、平台生成结果、种子内容或用户上传内容；公开或商业使用前必须确认对应权利。
