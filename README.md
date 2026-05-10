# 辩论广场 · Making Debate

> 让 ChatGPT、Claude、DeepSeek 围绕你的方案展开结构化辩论，迭代出比单方更完整的答案。
>
> A multi-LLM debate orchestrator that drives the **web UIs** of ChatGPT / Claude / DeepSeek (no API keys), borrowing from Andrej Karpathy's LLM Council pattern.

---

## 是什么

一个**不调 API**、纯网页自动化的多模型辩论系统。三方 AI 围绕你给的议题：

1. **各自给出初步方案**（并行）
2. **匿名互评 + 排名**（看不到作者身份的全部 3 份方案 → 批评 + `FINAL RANKING`）
3. **综合者综合**（你指定的模型拿到原方案 + 三方批评 + 排名汇总，输出最终方案 + 异同对照表）

整个过程实时三栏流式呈现，全程约 3–5 分钟。

## 为什么这么设计

- **不需要 API key** — 直接驱动你浏览器里已经登录的 ChatGPT / Claude / DeepSeek 网页版，绕开计费、上下文长度限制和模型版本不匹配
- **三方匿名互评** — 借鉴 [karpathy/llm-council](https://github.com/karpathy/llm-council)：每个模型在不知道作者身份的情况下给所有方案排名，避免 "总是觉得别人更聪明" 的风格偏向
- **结构化、可追溯** — 不追求胜负，追求观点碰撞；最终综合者拿到的不只是文本，还有客观排名汇总作为辅助信号

## 截图

UI 走 **编辑部美学（Editorial）**：暖墨黑底 + 米色印纸文本，全衬线字体（Fraunces / Newsreader）+ 等宽元数据（JetBrains Mono），Le Monde 式绛红强调色，罗马数字章节。三栏流式期间像三位专栏作家同时落笔。

## 快速开始

### 前置要求

- macOS（Linux/Windows 待支持，CDP 启动逻辑需调整路径）
- Node.js ≥ 22.5（用 `node:sqlite`，不需要原生编译）
- Chrome 或 Edge 浏览器
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

1. **拟订新议题** — 输入议题、设计原则（可空）、选择综合者
2. **配置参与方** — Claude（Sonnet 4.6 / Opus 4.7）、DeepSeek（快速 / 专家+深度思考、智能搜索开关）
3. **观看辩论** — 三栏实时流式呈现 4 个章节
4. **导出 Markdown** — 一键下载完整辩论记录（按阶段 + 模型分章节）

## 4 阶段辩论流程

| 章节 | 内容 | 并行 | 借鉴来源 |
|------|------|------|----------|
| **I 开题** | 系统拼 prompt 给三方 | — | — |
| **II 各自方案** | 三方独立输出初步方案 | ✓ | — |
| **III 互相批评 + 排名** | 看到匿名标签的全部 3 份方案 → 批评 + `FINAL RANKING:` | ✓ | Karpathy LLM Council |
| **IV 综合迭代** | 综合者拿到原方案 + 三方批评 + 排名汇总 → 异同表 + 最终方案 | — | — |

## 架构

```
┌──────────────────────────────────────────────┐
│  React + Vite (web/)                         │   编辑部美学 UI
│  └── WebSocket /ws/debates/:id               │   流式三栏
└──────────────────────┬───────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│  Express + tsx (server/)                     │
│  ├── HTTP /api/*                             │
│  ├── WS broadcast                            │
│  ├── Orchestrator  (4 阶段 + 匿名 + 排名)    │
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

- **同一会话续写** — 每个模型整场辩论只开 1 个浏览器对话；Phase III/IV 续写在 Phase II 的 thread 里，省 token 且利用模型自带上下文
- **匿名标签固定顺序** — 方案甲/乙/丙 按 Phase II 完成顺序固定映射，所有评估者看到的标签一致
- **排名解析** — 正则匹配 `FINAL RANKING:` + `\d+\.\s*方案[甲乙丙]`，单个评估者解析失败时跳过其票，剩余继续聚合
- **崩溃恢复** — server 启动时把 DB 里所有 `running`/`pending` 状态自动标 `error`（这种状态在新进程里不可能在飞）
- **Selector 集中管理** — 三家站点的 DOM selector 全部集中在 `server/src/browser/adapters/*.ts` 顶部 `SEL` 常量，UI 改版只改一处

## 技术栈

| 层 | 主要依赖 |
|---|---|
| 后端 | Node.js 22.5+ · TypeScript · Express · ws · Playwright (仅 `connectOverCDP`) · `node:sqlite` |
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
│   │   ├── api/           HTTP + WebSocket 路由
│   │   ├── browser/       CDP 管理 + 三个站点 adapter
│   │   ├── orchestrator/  4 阶段编排 + prompt 模板
│   │   ├── storage/       node:sqlite 包装 + schema
│   │   └── index.ts       入口（启动 launcher → CDP → HTTP/WS）
│   └── package.json
├── web/
│   ├── src/
│   │   ├── pages/         Home / NewDebate / DebateView
│   │   ├── components/    PhaseIndicator / ColumnStream / SummaryPanel
│   │   ├── hooks/         useDebateSocket
│   │   └── index.css      编辑部美学 design system
│   └── package.json
└── package.json           workspaces 根
```

## 已知限制

- 仅在 macOS + Chrome 下验证；Windows / Linux / Edge 路径需要自行调整 launcher
- 站点 selector 是按 2026-05 的 DOM 写的，UI 改版后需要更新对应 adapter
- 单进程同一时间只能跑 1 场辩论（多场会争抢三个浏览器 tab，未做排队）

## 致谢

- [karpathy/llm-council](https://github.com/karpathy/llm-council) — 匿名互评 + Chairman 综合的三阶段模式
- [Together MoA (Mixture-of-Agents)](https://github.com/togethercomputer/moa) — 多 agent 分层细化思路
- [Skytliang/Multi-Agents-Debate](https://github.com/Skytliang/Multi-Agents-Debate) — 早期 MAD 学术框架

## 许可证

MIT
