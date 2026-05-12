# 辩论广场 · Making Debate

> 让 ChatGPT、Claude、DeepSeek 围绕你的方案展开**五幕**结构化辩论，迭代出比单方更完整的答案。
>
> A multi-LLM debate orchestrator that drives the **web UIs** of ChatGPT / Claude / DeepSeek (no API keys), through a 5-phase loop: propose → critique → **revise** → synthesize → ratify-or-veto. Built on top of Andrej Karpathy's LLM Council pattern but extended so authors actually get to respond to criticism.

---

## 是什么

一个**不调 API**、纯网页自动化的多模型辩论系统。三方 AI 围绕你给的议题，跑完五个工作幕：

1. **各自方案**（并行）— 强制四段结构：问题界定 / 关键决策点 / 具体方案 / 预期失败模式
2. **互评 + 排名**（并行）— 对三份方案各写"决定性缺陷 / 可救的洞见 / 具体改动"三点 + `FINAL RANKING:`
3. **作者修订**（并行）— 看到批评后**真的改稿**：对每条针对自己的批评显式标"接受 / 反驳 / 反提案"，给出修订稿和坚守的取舍
4. **综合裁决**（综合者单独）— 异同对照表 + 关键分歧裁决（分类：事实/价值观/策略/范围 + 你的取舍 + 理由）+ 综合方案 + 少数派意见
5. **终稿复核**（非综合者并行）— ≤200 字 + `VERDICT: RATIFY` 或 `VERDICT: VETO — <具体条款>`

整场约 6–10 分钟。

## 为什么这么设计

- **不需要 API key** — 直接驱动你浏览器里已经登录的 ChatGPT / Claude / DeepSeek 网页版，绕开计费、上下文长度限制和模型版本不匹配
- **真正"迭代"的辩论** — 普通的"council"模式作者从不知道自己被批了什么，综合者代为消化。这里多了 Phase III（作者修订），让作者**显式回应**批评、改稿、坚守不让步的点。综合者拿到的是**修订后**的提案，不是原稿+评论的折中
- **同一对话续写** — 每个模型整场辩论只开 1 个浏览器对话；Phase III 起续写在 Phase II 的 thread 里，模型的自有上下文承担"我自己之前写了什么"的记忆，prompt 只递交真正缺失的信息（其他人的批评、修订稿、终稿）
- **关键分歧不被折中掩盖** — 综合者必须显式裁决每条分歧：分类（事实/价值观/策略/范围）+ 站哪一方 + 理由。同时保留 1-3 条少数派意见，标明"什么情况下应当重新考虑"
- **结构化、可追溯** — 不追求胜负，追求观点碰撞；所有产物都是带格式的 markdown，可一键导出

## 界面

UI 走**编辑部美学（Editorial）**：暖墨黑底 + 米色印纸文本，全衬线字体（Fraunces / Newsreader）+ 等宽元数据（JetBrains Mono），Le Monde 式绛红强调色，罗马数字章节。

**逐幕剧场**布局：顶部章节标签条（I-V）+ 一次只展开一幕的主区 + 底部"上/下一幕"导航。每幕用最贴合其数据形态的版式：
- **I 各自方案 / III 作者修订**：三栏作者并排
- **II 匿名互评**：**按被评方案聚合**——三张卡（方案甲/乙/丙），每张下面三个子段（决定性缺陷/可救洞见/具体改动），每条点评前缀 CL/GP/DS 标明评审者
- **IV 综合裁决**：四张明确卡片（异同对照 / 分歧裁决 / 综合方案 / 少数派）
- **V 终稿复核**：两张审稿卡，右上 RATIFY / VETO 角标

流式期间每栏内部滚动跟尾，页面整体高度不抖。完成后每栏可"展开全文"。任一格内容若被站点反爬虫拦截（ChatGPT "Unusual activity..."），可在该格头部点"重新获取 ↻"重新从模型 tab 抓取最新回复并覆盖入库。

## 快速开始

### 前置要求

- **macOS · Linux · Windows** 任一（首次启动会用独立 user-data-dir 接管 Chrome / Edge / Chromium）
- Node.js ≥ 22.5（用 `node:sqlite`，无需原生编译）
- Chrome / Edge / Chromium 任一（自动按平台默认路径查找；非标准安装可设 `BROWSER_BINARY=/path/to/chrome` 环境变量覆盖）
- ChatGPT、Claude、DeepSeek 三家账号

### 安装

```bash
git clone git@github.com:JZtt-kyle/making-debate.git
cd making-debate
npm install
```

### 首次运行

```bash
npm run dev    # 同时起 server (3001) + web (5173)
```

第一次启动会：

1. 在 `~/.making-debate/profile` 创建一个独立的 Chrome user-data-dir 并启动浏览器
2. 暴露 CDP 端口 9222 给后端 Playwright 接管
3. 在弹出的浏览器里手动登录 chatgpt.com / claude.ai / chat.deepseek.com（一次性）

之后访问 http://localhost:5173 开始使用。

### 使用流程

1. **拟订新议题** — 输入议题（可直接粘 markdown 文档；首行做标题，其余作"议题原文"段）、设计原则（可空）、选择综合者
2. **配置参与方** — Claude（Sonnet 4.6 / Opus 4.7）、DeepSeek（快速 / 专家+深度思考、智能搜索开关）
3. **观看辩论** — 顶部章节条标记进度，逐幕流式呈现
4. **导出 Markdown** — 一键下载完整辩论记录（清理过的 H1 + 五幕分段 + 终稿三段）

## 五幕辩论流程

| 章节 | 内容 | 并行 | 借鉴来源 |
|------|------|------|----------|
| **I 各自方案** | 三方独立输出结构化方案（4 个强制小节）| ✓ | — |
| **II 匿名互评** | 三方互评（每份"决定性缺陷/可救的洞见/具体改动" + `FINAL RANKING:`）| ✓ | Karpathy LLM Council |
| **III 作者修订** | 作者**真的回应批评**：对每条标"接受/反驳/反提案" + 修订稿 + 坚守的取舍 | ✓ | **本项目自有** |
| **IV 综合裁决** | 综合者基于修订稿（不是原稿）：异同对照 + 分歧裁决 + 综合方案 + 少数派意见 | — | — |
| **V 终稿复核** | 非综合者 ≤200 字 + `VERDICT: RATIFY / VETO — <条款>` | ✓ | **本项目自有** |

## 架构

```
┌──────────────────────────────────────────────┐
│  React + Vite (web/)                         │   编辑部美学 UI · 逐幕剧场
│  └── WebSocket /ws/debates/:id               │   实时流式
└──────────────────────┬───────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│  Express + tsx (server/)                     │
│  ├── HTTP /api/*                             │
│  ├── WS broadcast                            │
│  ├── Orchestrator  (5 幕 + 匿名 + 排名 + 裁决)│
│  ├── Storage  (node:sqlite)                  │
│  └── Browser CDP                             │
└──────────────────────┬───────────────────────┘
                       ↓ chromium.connectOverCDP
┌──────────────────────────────────────────────┐
│  Chrome --remote-debugging-port=9222         │
│         --user-data-dir=~/.making-debate/    │
│  ├── chatgpt.com                             │
│  ├── claude.ai                               │
│  └── chat.deepseek.com                       │
└──────────────────────────────────────────────┘
```

### 关键设计

- **同一对话续写** — 每个模型整场辩论只开 1 个 web 对话；Phase II→V 全部续写。模型自带"我之前说过什么"的上下文，prompt 只递交外部信息
- **匿名标签固定顺序** — 方案甲/乙/丙 按 Phase II 完成顺序固定映射，所有评审者看到的标签一致；server 端 `anon.ts` 集中管理
- **解析器在两端平行实现** — `FINAL RANKING` / `VERDICT` 等结构化输出的正则在 `server/src/orchestrator/parsers.ts` 和 `web/src/lib/parseDebateOutput.ts` 平行实现，注释指明 SOT 是 prompts.ts
- **崩溃恢复** — server 启动时把 DB 里所有 `running`/`pending` 状态自动标 `error`（这种状态在新进程里不可能在飞）
- **Selector 集中管理** — 三家站点的 DOM selector 全部集中在 `server/src/browser/adapters/*.ts` 顶部 `SEL` 常量；UI 改版只改一处
- **网格抖动防御** — 流式期间所有栏 `height` 锁定 560px、内部 `overflow:auto`，3 栏不同长度也不撑高 grid row，页面整体不重排
- **逐格重新获取** — ChatGPT 反爬虫之类拦截时存进 DB 的会是错误占位符；按面板头部"重新获取 ↻"会让 server reload 该模型 tab、抓取真实回复、覆盖该格存档
- **下载文件名三重保险** — 导出路径本身末段是 `debate-{id8}.md`（URL basename）+ `Content-Disposition: attachment; filename=...md` + 前端 `<a download>`；浏览器 / 扩展 / 同步 click 任一层失效都不会丢扩展名

## 技术栈

| 层 | 主要依赖 |
|---|---|
| 后端 | Node.js 22.5+ · TypeScript · Express · ws · Playwright (仅 `connectOverCDP`) · `node:sqlite` · turndown |
| 前端 | React 18 · Vite · React Router · react-markdown + remark-gfm |
| 字体 | Fraunces · Newsreader · JetBrains Mono · Source Han Serif / Songti SC |

## 配置项

### Claude
- 模型：`sonnet-4-6`（默认） / `opus-4-7`（自动展开 "More models" 菜单）

### DeepSeek
- 模式：`fast`（默认）/ `expert`（自动开启"深度思考"toggle）
- 智能搜索：开关，默认开

### ChatGPT
- 当前无配置项（默认模型 / 无插件）

## 目录结构

```
making-debate/
├── server/
│   ├── src/
│   │   ├── api/                HTTP + WebSocket 路由
│   │   ├── browser/            CDP 管理 + 三个站点 adapter (含 readLastAssistantMessage / hasAssistantMessage)
│   │   ├── orchestrator/
│   │   │   ├── debate.ts       5 幕编排
│   │   │   ├── prompts.ts      五段 PHASE*_PROMPT 模板
│   │   │   ├── parsers.ts      parseRanking / parsePhase5Output / parseVerdict
│   │   │   └── anon.ts         ANON_LABELS + anonymizeProposals + aggregateRankings
│   │   ├── storage/            node:sqlite 包装 + schema (含 dissent 列)
│   │   └── index.ts            入口
│   └── package.json
├── web/
│   ├── src/
│   │   ├── pages/              Home / NewDebate / DebateView
│   │   ├── components/
│   │   │   ├── PhaseStrip.tsx        顶部章节标签条
│   │   │   ├── PhaseFooterNav.tsx    底部上/下一幕导航
│   │   │   ├── ModelPanel.tsx        三栏作者卡片 (含 height 锁 + 展开切换)
│   │   │   ├── RefetchButton.tsx     "重新获取 ↻"
│   │   │   └── phases/               PhaseHeader + PhaseTwo..Six + ThreeColumns
│   │   ├── lib/
│   │   │   ├── models.ts             ModelName + MODEL_META + MODEL_ABBR + MODELS
│   │   │   ├── phases.ts             DebatePhase + PHASE_META + WORKING_PHASES
│   │   │   ├── parseDebateOutput.ts  ANON_LABELS + parseRanking + parseVerdict + parseCritiquesByTarget
│   │   │   └── displayTopic.ts       displayTitle + topicBody
│   │   ├── hooks/
│   │   │   ├── useDebateSocket.ts    WS 客户端
│   │   │   └── useRefetchMessage.ts  POST /messages/refetch + 状态合并
│   │   └── index.css           编辑部美学 design system
│   └── package.json
└── package.json                workspaces 根
```

## 已知限制

- 仅在 **macOS + Chrome** 下完整验证；Linux / Windows 二进制查找路径已实现但**未实测**，遇问题可设 `BROWSER_BINARY` 环境变量绕过路径探测
- 站点 selector 是按 2026-05 的 DOM 写的，UI 改版后需要更新对应 adapter（`server/src/browser/adapters/*.ts` 顶部 `SEL` 常量）
- 单进程同一时间只能跑 1 场辩论（多场会争抢三个浏览器 tab，未做排队）
- 长 markdown 议题原文不会自动嵌套降级（用户原本的 H2 仍是 H2 进导出文档）

### 浏览器路径自动查找

| 平台 | 默认查找的二进制 |
|---|---|
| macOS | `/Applications/Google Chrome.app/...`、`Microsoft Edge.app`、`Chromium.app` |
| Linux | `/usr/bin/google-chrome[-stable]`、`chromium[-browser]`、`/snap/bin/chromium`、`microsoft-edge[-stable]` |
| Windows | `Program Files\Google\Chrome\...\chrome.exe`、Program Files (x86)、`%LOCALAPPDATA%`、Edge 同样三处、Chromium |

非标准安装（便携版 / 自编译 / WSL 路径）请直接：

```bash
BROWSER_BINARY=/your/custom/path/chrome npm run dev
```

## 致谢

- [karpathy/llm-council](https://github.com/karpathy/llm-council) — 匿名互评 + Chairman 综合的三阶段模式，本项目在此基础上扩展了作者修订 / 终稿复核两幕
- [Together MoA (Mixture-of-Agents)](https://github.com/togethercomputer/moa) — 多 agent 分层细化思路
- [Skytliang/Multi-Agents-Debate](https://github.com/Skytliang/Multi-Agents-Debate) — 早期 MAD 学术框架

## 许可证

MIT
