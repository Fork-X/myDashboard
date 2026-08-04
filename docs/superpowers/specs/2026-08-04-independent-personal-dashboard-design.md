# 独立个人看板第一版设计

## 1. 目标与原则

`myDashboard` 是完全独立的新项目。它不读取、不迁移、不映射、不兼容 Self Vault，也不继承旧项目的 `records`、`tasks`、`type` 或通用领域分类。

第一版目标：保留现有国风页面与五个模块入口，只实现“个人思考”和“待办规划”；投资理财、职业生涯、个人项目保留占位。应用本地优先、可下载、可直接运行，SQLite 是唯一数据源。

优先级：隐私与正确性 > 可恢复性 > 完整性 > 速度。

## 2. 第一版范围

### 实现

- 保留首页、个人思考、待办规划、投资理财、职业生涯、个人项目页面和国风视觉语言。
- 个人思考由 AI 通过本地 CLI 提炼并追加，页面只读。
- 持续目标、目标进展和 TODO 在待办规划页面中编辑。
- 本地 Node 和 Docker 两种启动方式。
- 首次启动自动创建空 SQLite 数据库并执行 migrations。

### 不实现

- Self Vault 导入、兼容层、映射、同步或回写。
- 旧数据迁移、Mock 回退、演示数据或 seed 命令。
- 投资理财、职业生涯、个人项目的业务表和写入规则。
- 个人思考的覆盖、修改和删除。
- 目标与 TODO 的关联、KR、子任务、重复规则和截止日期。
- AI 对话原文、来源、对话 ID、消息位置、轮次、置信分或规则版本的存储。
- 个人 SQLite 数据的备份、恢复和跨设备传递。
- MySQL、PostgreSQL、Redis、云数据库或云账号。

## 3. 运行架构

```text
Browser
  -> single Node process
       -> React static files
       -> same-origin HTTP API
       -> SQLite through node:sqlite
            -> data/dashboard.sqlite3

AI conversation
  -> local thought extraction CLI
       -> shared validation and data module
            -> SQLite
```

- Node 同时提供 React 静态文件和同源 API。
- SQLite 内嵌在 Node 进程中，不运行独立数据库服务。
- Docker 只包含一个 app 容器，并挂载 `./data:/app/data`。
- 本地运行和 Docker 运行使用相同的 migration、API 和数据目录约定。
- 首页直接读取现有业务接口，不创建首页专属表或统计服务。

## 4. 数据模型

除技术表 `schema_migrations` 外，第一版只创建四张业务表。

### 4.1 thoughts

| 字段 | 约束 |
|---|---|
| `id` | TEXT PRIMARY KEY，由系统生成 |
| `title` | TEXT NOT NULL，去除首尾空白后非空 |
| `content` | TEXT NOT NULL，去除首尾空白后非空 |
| `tags_json` | TEXT NOT NULL DEFAULT `'[]'` |
| `created_at` | TEXT NOT NULL，由系统在写入时生成 |

规则：

- AI 只能追加，应用不提供修改或删除路径。
- 标签只能来自用户明确指定；AI 不自行创建标签。
- 未明确指定标签时写入空数组。
- 页面按 `created_at` 倒序展示，并支持标题、正文搜索和标签筛选。
- 相同标题与正文在运行机器的同一自然日重复执行时只保留一条。

### 4.2 goals

| 字段 | 约束 |
|---|---|
| `id` | TEXT PRIMARY KEY |
| `title` | TEXT NOT NULL，去除首尾空白后非空 |
| `description` | TEXT NOT NULL DEFAULT `''` |
| `status` | `active / paused / completed / abandoned`，新建默认 `active` |
| `created_at` | TEXT NOT NULL |
| `updated_at` | TEXT NOT NULL |

目标是持续性的方向，不按年度或月度分类，也不拆分 KR。

### 4.3 goal_progress

| 字段 | 约束 |
|---|---|
| `id` | TEXT PRIMARY KEY |
| `goal_id` | TEXT NOT NULL，外键指向 `goals.id` |
| `content` | TEXT NOT NULL，去除首尾空白后非空 |
| `created_at` | TEXT NOT NULL，由系统在追加时生成 |

规则：

- 每个目标拥有零到多条按时间追加的进展。
- 进展新增后不可修改、不可删除；更正通过追加新记录表达。
- 数据库层阻止 `UPDATE` 和 `DELETE`。
- 已有进展的目标禁止删除，只能将状态改为 `abandoned`。
- 无进展目标允许在二次确认后删除。

### 4.4 todos

| 字段 | 约束 |
|---|---|
| `id` | TEXT PRIMARY KEY |
| `title` | TEXT NOT NULL，去除首尾空白后非空 |
| `status` | `pending / in_progress / completed / cancelled`，新建默认 `pending` |
| `is_important` | INTEGER NOT NULL DEFAULT `0`，值为 `0 / 1` |
| `is_urgent` | INTEGER NOT NULL DEFAULT `0`，值为 `0 / 1` |
| `tags_json` | TEXT NOT NULL DEFAULT `'[]'` |
| `created_at` | TEXT NOT NULL |
| `completed_at` | TEXT NULL |

规则：

- 重要和紧急是两个正交维度，页面据此计算四象限，不保存 `priority` 枚举。
- 标签是用户可编辑的自由多标签；去除空白、删除空值并去重。
- 状态进入 `completed` 时生成 `completed_at`；重新打开或取消时清空。
- TODO 与目标不关联。
- 所有状态的 TODO 都允许在二次确认后删除；正常放弃使用 `cancelled`。

## 5. AI 个人思考写入

### 5.1 最小输入

```json
{
  "title": "提炼后的标题",
  "content": "提炼后的正文",
  "tags": []
}
```

- `id` 和 `created_at` 由系统生成，不接受 AI 输入。
- 不接受输入格式之外的来源、证据、置信分或对话定位字段。
- 一次 CLI 调用处理一条思考。

### 5.2 写入行为

- CLI 默认 preview，只验证和打印候选，数据库零写入。
- `--apply` 才在单个事务中写入。
- 直接、明确、无歧义且不冲突的用户陈述可以自动 `--apply`。
- AI 推断、歧义表达、缺少必要语境、相互冲突或敏感内容只 preview，用户确认后再 apply。
- 数值置信分不决定是否写入。
- 用户对执行者的工作指令不自动转换为个人思考或 TODO。
- AI 不修改或删除已有思考；后续认识通过新增内容补充。
- 确定性内容标识保证同一候选在同一自然日重试不会重复新增。

## 6. HTTP API

### 个人思考

- `GET /api/thoughts`

不提供网页新增、修改或删除接口。

### 目标与进展

- `GET /api/goals`
- `POST /api/goals`
- `PATCH /api/goals/:id`
- `DELETE /api/goals/:id`
- `POST /api/goals/:id/progress`

不提供进展的 `PATCH` 或 `DELETE` 接口。

### TODO

- `GET /api/todos`
- `POST /api/todos`
- `PATCH /api/todos/:id`
- `DELETE /api/todos/:id`

所有输入由服务端验证，所有写操作使用 SQLite 事务。非法输入、约束冲突和不存在的资源返回明确错误，不产生部分写入。

## 7. 页面设计

### 7.1 首页

首页采用“轻量总览 + 五个模块入口”，不建立首页数据表：

- 最近一条个人思考。
- `active` 持续目标数量及最近一条目标进展。
- 重要且紧急 TODO 数量及全部待处理数量。
- 五个模块入口；未实现模块显示“待设计”。
- 空数据如实显示，不使用 Mock、新闻、AI 推荐或复杂图表。

### 7.2 个人思考

- 保留国风卡片和档案编号视觉。
- 删除固定分类和 `type` 展示。
- 提供标题/正文搜索和标签筛选。
- 只展示标题、提炼正文、标签和创建时间。
- 页面无新增、编辑和删除控件。

### 7.3 待办规划

同一页面包含两个标签页：

- 持续目标：目标列表、状态、编辑操作、追加进展和不可修改的进展时间线。
- TODO 四象限：根据 `is_important × is_urgent` 展示四个区域，支持新增、编辑、状态更新和删除。

持续目标和 TODO 四象限不作为首页独立模块。

### 7.4 占位页面

投资理财、职业生涯、个人项目保留国风页面框架，统一显示“功能待设计”，不调用业务 API、不展示演示数据。

## 8. 启动与分发

### 本地 Node

```bash
npm ci
npm run build
npm start
```

### Docker

```bash
docker compose up --build
```

首次启动自动创建 `data/dashboard.sqlite3` 并执行 migrations。默认数据库为空，不提供 demo 或 seed。

Git 仓库必须忽略 `data/`、SQLite/WAL/SHM、环境文件、密钥和本地设计产物。仓库不得包含个人数据、Self、旧导入映射、旧迁移材料或 Mock 业务数据。

## 9. 错误与恢复边界

- API 加载失败显示明确错误，不静默回退。
- 空数据库显示真实空状态。
- CLI preview 失败或 apply 验证失败均零写入。
- 事务失败完整回滚。
- 目标删除约束和进展不可变约束由数据库与服务端共同执行。
- TODO 删除在页面二次确认；服务端只删除指定 ID。
- 第一版不承担个人数据库备份、恢复或跨设备迁移。

## 10. 验收标准

- 空数据目录首次启动只创建 `thoughts`、`goals`、`goal_progress`、`todos` 和 `schema_migrations`。
- schema 不包含旧 `records`、`tasks`、`type` 或任何 Self 表。
- 个人思考 preview 零写入，apply 单事务写入，同日相同内容重跑不增行。
- AI 和网页均不能修改或删除个人思考。
- 目标 CRUD、四种状态和删除约束通过测试。
- 进展只能追加；数据库直接拒绝修改和删除。
- TODO CRUD、四种状态、四象限字段、自由标签和完成时间规则通过测试。
- 首页轻量总览只读取已实现模块数据。
- 三个占位页不请求业务 API。
- 页面保留现有国风视觉，不包含旧热点新闻、薪资、密码或锁控件。
- fresh clone 在无 Self、无云账号、无外部数据库时通过：

```bash
npm ci
npm test
npm run typecheck
npm run build
npm start
```

- Docker 单 app 容器通过健康检查，数据目录挂载为 `./data:/app/data`。
- Git 树和历史不包含 SQLite、个人数据、Self、旧导入映射、密钥或迁移材料。
