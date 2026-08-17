# Local Personal Dashboard

本地优先的个人仪表盘：单个 Node 进程同时提供 React 页面、同源 HTTP API 和内嵌 SQLite。
不接入外部数据库，不包含演示数据和个人数据；外部依赖只有两类：只读拉取的 RSS 信源，以及 AI 能力所需的 qodercli 登录。

## 功能一览

- **投资理财**（核心）：板块化 AI 事件扫描 → 收件箱人工确收 → 事件时间线
- 想法记录（网页只读，CLI 导入）、AI 对话与提炼
- 待办四象限：TODO 支持新增、编辑、更新状态和删除；目标支持新增、编辑与追加不可修改的进展
- 职业生涯与个人项目目前是占位模块

## 新电脑上手（按顺序读）

1. **[docs/DEVLOG.md](docs/DEVLOG.md)** —— 当前状态：已完成什么、哪些是半成品、下一步做什么
2. **[docs/SCAN-PIPELINE.md](docs/SCAN-PIPELINE.md)** —— 扫描链路操作手册：策略文件怎么改、环境约束（内网 WebSearch 挂死等）、排查速查
3. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** —— 逐文件代码地图

> `docs/archive/` 下是 2026-08-04 的初始设计稿，已被板块化架构取代，仅作历史记录。

## 本地运行

前置：Node.js `>=24.15.0`；AI 功能需本机 `qodercli login` 有效（chat/扫描/提炼共用）。

```bash
npm ci
npm test          # 当前应全绿
npm run typecheck
npm run build
npm start         # http://127.0.0.1:3015
```

首次启动自动建库并跑迁移，数据库为空，页面如实显示空状态；数据在 `data/dashboard.sqlite3`（**gitignore，不随仓库走**——换机后题材需在 UI 重建，或手动拷贝该文件）。健康探针：`/api/health`。

开发模式：`npm run dev`（前端 3000，代理到后端 3016）。

## 常用命令

| 命令 | 用途 |
|---|---|
| `npm run scan:dry [板块]` | 空跑扫描管道：验证信源可达性 + prompt 渲染，不调 AI 不花钱 |
| `npm run db:migrate` | 手动执行数据库迁移 |
| `npm run thought:import -- --input <file> [--apply]` | 导入想法：默认只预览，加 `--apply` 才写入 |

导入想法的 JSON 格式：

```json
{ "title": "提炼后的标题", "content": "提炼后的正文", "tags": ["标签"] }
```

## 投资扫描（一分钟版）

- 策略配置在 `asset/`：`_default/` 是缺省仓库，板块目录（航天/化工/机器人/半导体）只写差异项
- 信源为原生 RSS，AI 只做提取不联网（内网 WebSearch 不可用，详见 SCAN-PIPELINE.md）
- 改完任何策略文件：`npm run scan:dry` → 读 `data/dry-run/{板块}.md` → UI 触发真实扫描
- 每次扫描发给模型的完整 prompt 落盘在 `data/last-prompt/`，出问题先看它
