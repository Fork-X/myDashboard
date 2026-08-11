# myDashboardV2 架构设计与功能说明

## 1. 项目定位

个人独立仪表盘（Personal Dashboard），整合**想法记录、待办四象限、目标跟踪、AI 对话、投资理财（事件日历 / 题材扫描 / 收件箱）**五大功能域。前后端分离，单用户本地部署，无鉴权。

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Tailwind CSS + react-router-dom + react-markdown，webpack 5 构建 |
| 后端 | Node.js 原生 `node:http`（无 Express 等框架）+ `node:sqlite`（Node 内置实验性 SQLite） |
| AI | qoder-agent-sdk（chat 会话 / 题材扫描 / 对话提炼） |
| 数据库 | SQLite（WAL 模式），文件位于 `data/dashboard.sqlite3` |
| 测试 | node:test 原生测试运行器 |

**运行端口**：开发模式前端 webpack-dev-server `3000`（代理 `/api/*` → `3016`），后端 `3016`（由 `scripts/dev.mjs` 注入 `PORT`）；`npm start` 启动时后端默认 `3015`。

## 3. 顶层数据流

```
浏览器 ──HTTP/SSE──> server/http/handler.mjs ──> server/db/*.mjs ──> SQLite
                        │
                        ├─> chat/session-manager.mjs ──> qoder-agent-sdk（AI 会话）
                        └─> scanner.mjs（定时轮询）──> qoder-agent-sdk（AI 扫描）──> inbox_items 表
```

## 4. 后端（server/）逐文件说明

### 入口与装配

| 文件 | 作用 |
|---|---|
| `server/index.mjs` | 服务入口：打开数据库 → 跑迁移 → 创建 chat manager / scanner → 启动 HTTP 监听；注册优雅退出 |

### HTTP 层

| 文件 | 作用 |
|---|---|
| `server/http/handler.mjs` | 全部路由分发：REST API（thoughts/todos/goals/chats/investment 五域）、SSE 流（`/api/chats/:id/stream`，25s 心跳）、静态文件服务（含 symlink 逃逸防护）、SPA fallback |
| `server/http/response.mjs` | `sendJson` / `readJson`（默认上限 256KB，chat 消息端点放宽至 1MB）/ `sendError` 统一响应工具 |

### 数据层（db/）

| 文件 | 作用 |
|---|---|
| `db/database.mjs` | `openDatabase`：封装 node:sqlite 连接（WAL、外键开启） |
| `db/migrate.mjs` | 迁移执行器：按序应用 migrations，幂等（已应用则跳过） |
| `db/migrations/001_initial.sql` | thoughts / todos / goals / goal_progress 表 |
| `db/migrations/002_conversations.sql` | conversations / messages 表（级联删除） |
| `db/migrations/003_investment.sql` | tickers / events / directions / inbox_items 表 |
| `db/thoughts.mjs` | 想法 CRUD；同日同标题内容去重（按本地日历日而非 UTC） |
| `db/todos.mjs` | 待办 CRUD；四象限（重要/紧急正交布尔）、完成生命周期、严格字段白名单校验 |
| `db/goals.mjs` | 目标 CRUD + 进度时间线（有进度的目标禁止删除，由 DB 约束保证） |
| `db/conversations.mjs` | 对话与消息持久化；首条用户消息自动生成标题 |
| `db/investment.mjs` | 投资域四实体：ticker（按 symbol 去重）、event（伏击天数/标签/关联股票）、direction（扫描题材）、inbox_item（pending→converted/ignored 状态机，转换时事务内创建 event） |

**统一约定**：所有写操作包事务（`BEGIN IMMEDIATE`）；输入严格校验（`rejectUnknownFields` 白名单 + 类型检查，TypeError → 400）。

### AI 对话（chat/）

| 文件 | 作用 |
|---|---|
| `chat/session-manager.mjs` | SDK 会话池：容量上限 + 最久空闲淘汰；`send` 持久化用户消息并投递 SDK inbox；SSE 广播 delta/thinking/message/turn_end；`subscribe` 先回放缓存状态 |
| `chat/model-policy.mjs` | 模型选择：由 `AI_MODEL` 环境变量决定（默认 `kmodel_latest` = Kimi-K3），在 `index.mjs` 的 `queryFn` 中统一注入，chat / 扫描 / 提炼三处共用 |
| `chat/distiller.mjs` | 对话 → 想法提炼：调用 skill 输出 JSON，解析容错（无法解析返回 502），`shouldSave=false` 时不落库 |

### 扫描器

| 文件 | 作用 |
|---|---|
| `server/scanner.mjs` | 题材定时扫描：5 分钟轮询 directions，到期/未扫描的调 AI（WebSearch）生成事件 JSON，多阶段提取（code block → 括号配平正则），写入 inbox_items；内存占位防重入（同一题材不并发扫描），单条坏数据丢弃不拖垮整批 |

### CLI

| 文件 | 作用 |
|---|---|
| `cli/import-thought.mjs` | 从 JSON 文件导入想法：`--preview` 无副作用预演；`--apply` 事务写入（重复导入幂等） |
| `cli/migrate.mjs` | 手动执行数据库迁移 |

## 5. 前端（src/）逐文件说明

### 基础设施

| 文件 | 作用 |
|---|---|
| `src/index.tsx` / `App.tsx` | 入口与路由表（/、/thoughts、/todos、/chat、/investment/* 等） |
| `src/api/types.ts` | 全部 API 契约类型（含 SSE 事件联合类型） |
| `src/api/client.ts` | fetch 封装：统一 `ApiError`、各域 API 函数、响应 parse 校验 |
| `src/utils/export.ts` | 数据导出（下载 JSON/Markdown） |
| `src/hooks/useTheme.ts` | 明暗主题切换 |

### 数据 hooks（每域一个，模式统一：load → CRUD → 错误态）

`useThoughts` / `useTodos` / `useGoals` / `useConversations` / `useEvents` / `useTickers` / `useDirections` / `useInbox`

| 文件 | 特殊逻辑 |
|---|---|
| `src/hooks/useChatStream.ts` | SSE 流式对话：EventSource 订阅 delta/thinking 累积草稿，message 去重落列，turn_end 清草稿；切换会话时取消竞态 |

### 页面（pages/）

| 文件 | 功能 |
|---|---|
| `Home.tsx` | 总览：聚合 thoughts/todos/goals 三 hook |
| `Thoughts.tsx` | 想法流：搜索 + 标签过滤 + 新增 |
| `Todos.tsx` | 待办四象限看板 + 目标进度（GoalForm/GoalProgressForm） |
| `Chat.tsx` | 对话页：会话列表 + 流式消息 + DistillModal 提炼 |
| `Investment.tsx` | 投资域布局：子导航（日历/题材/收件箱）+ Outlet |
| `InvestmentCalendar.tsx` | 事件日历 + 阶段时间轴（PhaseBar：潜伏期/准备期/事件期） |
| `DirectionBoard.tsx` | 题材管理 + 手动触发扫描 |
| `Inbox.tsx` | AI 收件箱：确认（编辑后转事件）/ 忽略 |
| `Career.tsx` / `Projects.tsx` | 占位页（ComingSoon） |

### 组件（components/）

- `layout/`：Header / Sidebar / Layout 骨架
- `common/`：Card / Modal / Loading / ErrorState / EmptyState / ComingSoon 通用件
- `chat/`：MessageItem（Markdown 渲染消息）、DistillModal
- `todos/`：TodoForm / TodoList / GoalForm / GoalProgressForm / GoalsList
- `investment/`：EventForm / EventDetail / DirectionForm / TickerSelector / PhaseBar
- `Markdown.tsx`：react-markdown + remark-gfm（未启用 rehype-raw，无 HTML 注入面）

## 6. 测试体系

| 位置 | 覆盖 |
|---|---|
| `server/**/*.test.mjs` | 数据层五域单测（含事务回滚、字段严格性）、http handler（含 symlink 防护）、chat（会话池/提炼）、CLI 导入 |
| `tests/fresh-start.test.mjs` | 全新环境启动冒烟 |
| `tests/repository-boundary.test.mjs` | 仓库边界守护（已删除文件不得复活） |
| `tests/frontend/*-contract.test.mjs` | 前端契约（页面占位一致性、新模型契约） |

**现状**：147 个测试全部通过；`tsc --noEmit` 通过。

## 7. 部署

仅本地部署：`npm run build` 产出 `dist/`，`npm start` 启动单个 Node 进程同时提供静态页面与同源 API（默认 `127.0.0.1:3015`，可用 `HOST` / `PORT` 覆盖）；数据落在 `data/dashboard.sqlite3`。`scripts/dev.mjs` 用于本地双进程开发启动。
