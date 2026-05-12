# 辩论广场 · Making Debate

> 让 ChatGPT、Claude、DeepSeek 围绕你的方案展开五幕结构化辩论，迭代出比单方更完整的答案。
>
> A multi-LLM debate orchestrator that drives the **web UIs** of ChatGPT / Claude / DeepSeek (no API keys), through a 5-phase loop: propose → critique → revise → synthesize → ratify-or-veto.

---

## 是什么

一个**不调 API**、纯网页自动化的多模型辩论系统。三方 AI 围绕你给的议题，跑完五幕：

1. **各自方案**（并行）— 结构化四段：问题界定 / 关键决策点 / 具体方案 / 预期失败模式
2. **互评 + 排名**（并行）— 对每份方案写"决定性缺陷 / 可救的洞见 / 具体改动"+ `FINAL RANKING:`
3. **作者修订**（并行）— 对每条针对自己的批评显式标"接受 / 反驳 / 反提案"，给出修订稿和坚守的取舍
4. **综合裁决**（综合者单独）— 异同对照表 + 关键分歧裁决（事实/价值观/策略/范围 + 取舍 + 理由）+ 综合方案 + 少数派意见
5. **终稿复核**（非综合者并行）— ≤200 字 + `VERDICT: RATIFY` 或 `VERDICT: VETO — <具体条款>`

整场约 6–10 分钟。

## 为什么这么设计

- **不需要 API key** — 直接驱动你浏览器里已经登录的 ChatGPT / Claude / DeepSeek 网页版，绕开计费、上下文长度限制和模型版本不匹配
- **作者参与迭代** — 作者看到针对自己的批评后显式回应、改稿，并坚持不让步的点；综合者拿到的是修订后的提案，不是原稿 + 评论的折中
- **关键分歧不被折中掩盖** — 综合者必须显式裁决每条分歧：分类 + 站哪一方 + 理由；同时保留少数派意见和"什么情况下应当重新考虑"
- **同一对话续写** — 每个模型整场只开 1 个浏览器对话，自带"我之前说过什么"的上下文，prompt 只递交外部信息
- **结构化、可追溯** — 所有产物都是带格式的 markdown，可一键导出完整辩论记录

## 界面

UI 走**编辑部美学**：暖墨黑底 + 米色印纸文本，全衬线字体（Fraunces / Newsreader）+ 等宽元数据（JetBrains Mono），Le Monde 式绛红强调色，罗马数字章节。

**逐幕剧场**布局：顶部章节标签条（I-V）+ 一次展开一幕的主区 + 底部"上/下一幕"导航。每幕用最贴合其数据形态的版式：
- **I 各自方案 / III 作者修订**：三栏作者并排
- **II 匿名互评**：按被评方案聚合——三张卡（方案甲/乙/丙），每张下三个子段（决定性缺陷/可救洞见/具体改动），每条点评前缀 CL/GP/DS 标明评审者
- **IV 综合裁决**：四张明确卡片（异同对照 / 分歧裁决 / 综合方案 / 少数派）
- **V 终稿复核**：两张审稿卡，右上 RATIFY / VETO 角标

流式期间每栏内部滚动跟尾，页面整体不抖。完成后每栏可展开全文。任一格内容若被反爬虫拦截（如 ChatGPT "Unusual activity..."），可在该格头部点"重新获取 ↻"重新从模型 tab 抓取真实回复并覆盖入库。

## 快速开始

### 前置要求

- **macOS · Linux · Windows** 任一
- Node.js ≥ 22.5（用 `node:sqlite`，无需原生编译）
- Chrome / Edge / Chromium 任一（自动按平台默认路径查找；非标准安装可设 `BROWSER_BINARY=/path/to/chrome` 覆盖）
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
4. **导出 Markdown** — 一键下载完整辩论记录

## 五幕辩论流程

| 章节 | 内容 | 并行 |
|------|------|------|
| **I 各自方案** | 三方独立输出结构化方案（四个强制小节） | ✓ |
| **II 匿名互评** | 三方互评每份方案 + `FINAL RANKING:` | ✓ |
| **III 作者修订** | 作者对批评显式回应 + 修订稿 + 坚守的取舍 | ✓ |
| **IV 综合裁决** | 综合者基于修订稿：异同 + 分歧裁决 + 综合方案 + 少数派 | — |
| **V 终稿复核** | 非综合者 ≤200 字 + `VERDICT: RATIFY / VETO — <条款>` | ✓ |

## 架构

```
┌──────────────────────────────────────────────┐
│  React + Vite (web/)                         │
│  └── WebSocket /ws/debates/:id               │
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

- **同一对话续写** — 每个模型整场辩论只开 1 个 web 对话；Phase II→V 全部续写
- **匿名标签固定顺序** — 方案甲/乙/丙 按 Phase II 完成顺序固定映射，所有评审者看到的标签一致
- **解析器在两端平行实现** — `FINAL RANKING` / `VERDICT` 等结构化输出的正则在 server 和 web 各一份，注释指明 SOT 是 prompts.ts
- **崩溃恢复** — server 启动时把 DB 里所有 `running`/`pending` 状态自动标 `error`
- **Selector 集中管理** — 三家站点的 DOM selector 全部集中在 `server/src/browser/adapters/*.ts` 顶部 `SEL` 常量；UI 改版只改一处
- **网格抖动防御** — 流式期间所有栏 `height` 锁定 + 内部 `overflow:auto`，3 栏不同长度也不撑高 grid row
- **逐格重新获取** — 反爬虫拦截或流式失败时，按格头部"重新获取 ↻"会让 server reload 该模型 tab 抓取真实回复
- **下载文件名三重保险** — 导出路径末段 + Content-Disposition + 前端 `<a download>`；任一层失效都不会丢扩展名

## 技术栈

| 层 | 主要依赖 |
|---|---|
| 后端 | Node.js 22.5+ · TypeScript · Express · ws · Playwright (仅 `connectOverCDP`) · `node:sqlite` · turndown |
| 前端 | React 18 · Vite · React Router · react-markdown + remark-gfm |
| 字体 | Fraunces · Newsreader · JetBrains Mono · Source Han Serif / Songti SC |

## 配置项

### Claude
- 模型：`sonnet-4-6`（默认） / `opus-4-7`

### DeepSeek
- 模式：`fast`（默认）/ `expert`（自动开启"深度思考"）
- 智能搜索：开关，默认开

### ChatGPT
- 当前无配置项（默认模型 / 无插件）

## 目录结构

```
making-debate/
├── server/
│   ├── src/
│   │   ├── api/                HTTP + WebSocket 路由
│   │   ├── browser/            CDP 管理 + 三个站点 adapter
│   │   ├── orchestrator/
│   │   │   ├── debate.ts       5 幕编排
│   │   │   ├── prompts.ts      五段 PHASE*_PROMPT 模板
│   │   │   ├── parsers.ts      parseRanking / parsePhase5Output / parseVerdict
│   │   │   └── anon.ts         匿名标签 + 排名聚合
│   │   ├── storage/            node:sqlite 包装 + schema
│   │   └── index.ts            入口
│   └── package.json
├── web/
│   ├── src/
│   │   ├── pages/              Home / NewDebate / DebateView
│   │   ├── components/
│   │   │   ├── PhaseStrip.tsx        顶部章节标签条
│   │   │   ├── PhaseFooterNav.tsx    底部上/下一幕导航
│   │   │   ├── ModelPanel.tsx        作者卡片
│   │   │   ├── RefetchButton.tsx     重新获取
│   │   │   └── phases/               PhaseHeader + PhaseTwo..Six + ThreeColumns
│   │   ├── lib/
│   │   │   ├── models.ts             模型元数据
│   │   │   ├── phases.ts             章节元数据
│   │   │   ├── parseDebateOutput.ts  排名 / 批评 / verdict 解析
│   │   │   └── displayTopic.ts       议题标题与正文拆分
│   │   ├── hooks/
│   │   │   ├── useDebateSocket.ts    WS 客户端
│   │   │   └── useRefetchMessage.ts  重新获取 + 状态合并
│   │   └── index.css           编辑部美学 design system
│   └── package.json
└── package.json                workspaces 根
```

## 已知限制

- 仅在 **macOS + Chrome** 下完整验证；Linux / Windows 二进制查找路径已实现但**未实测**
- 站点 selector 是按 2026-05 的 DOM 写的，UI 改版后需要更新对应 adapter
- 单进程同一时间只能跑 1 场辩论（多场会争抢三个浏览器 tab，未做排队）

### 浏览器路径自动查找

| 平台 | 默认查找的二进制 |
|---|---|
| macOS | `/Applications/Google Chrome.app/...`、`Microsoft Edge.app`、`Chromium.app` |
| Linux | `/usr/bin/google-chrome[-stable]`、`chromium[-browser]`、`/snap/bin/chromium`、`microsoft-edge[-stable]` |
| Windows | `Program Files\Google\Chrome\...\chrome.exe`、Program Files (x86)、`%LOCALAPPDATA%`、Edge 同样三处、Chromium |

非标准安装请直接：

```bash
BROWSER_BINARY=/your/custom/path/chrome npm run dev
```

## 致谢

- [karpathy/llm-council](https://github.com/karpathy/llm-council) — 匿名互评 + Chairman 综合模式
- [Together MoA (Mixture-of-Agents)](https://github.com/togethercomputer/moa) — 多 agent 分层细化思路
- [Skytliang/Multi-Agents-Debate](https://github.com/Skytliang/Multi-Agents-Debate) — 早期 MAD 学术框架

## 许可证

MIT
