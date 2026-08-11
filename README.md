# Local Personal Dashboard

一个完全独立、本地优先的个人看板。Node 进程同时提供 React 页面、同源 HTTP API 和内嵌 SQLite；SQLite 是唯一运行时数据源。

本项目不读取任何外部内容源，不需要云账号，不接入外部数据库，不包含演示数据，也不包含个人数据。首次启动会自动创建数据库并执行迁移，数据库为空，页面如实显示空状态。

## 功能范围

- 个人思考：通过本地 CLI 预览并追加，网页只读。
- 待办规划：可在网页新增、编辑和更新持续目标，追加不可修改的目标进展；TODO 支持新增、编辑、更新状态和删除。
- 投资理财、职业生涯、个人项目目前是“功能待设计”的占位模块，不请求业务数据。

## 本地运行

前置条件：Node.js `>=24.15.0`。

从全新检出开始安装、验证、构建并启动：

```bash
npm ci
npm test
npm run typecheck
npm run build
npm start
```

打开 <http://127.0.0.1:3015>。启动过程会先执行数据库迁移，再监听端口；数据默认保存在 `data/dashboard.sqlite3`。按 `Ctrl+C` 停止服务，再次运行 `npm start` 会继续使用同一数据库。

需要确认服务是否已就绪时，访问 <http://127.0.0.1:3015/api/health>，正常返回 `{"data":{"status":"ok"}}`。

## 导入个人思考

准备一个绝对路径下的 JSON 文件，例如 `/absolute/path/to/thought.json`：

```json
{
  "title": "提炼后的标题",
  "content": "提炼后的正文",
  "tags": ["用户明确指定的标签"]
}
```

先运行 preview。它只校验并打印规范化后的候选，不创建或写入数据库：

```bash
npm run thought:import -- --input /absolute/path/to/thought.json
```

确认内容后再显式写入：

```bash
npm run thought:import -- --input /absolute/path/to/thought.json --apply
```

`id` 和创建时间由系统生成；同一自然日重复 apply 相同标题和正文不会新增重复记录。CLI 不提供修改或删除已有思考的命令。

## 首次运行

全新的 `data` 目录是正常状态：个人思考、持续目标、目标进展和 TODO 都为空。项目没有预置数据命令，也不会静默加载 Mock 或外部内容；可以从空状态开始在网页维护目标和 TODO，并通过上述 CLI 追加个人思考。
