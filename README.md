# Local Personal Dashboard

这是一个本地优先的个人看板。数据只保存在本机 SQLite 中；新数据库默认没有任何记录，页面会如实显示空状态，不会自动加载演示数据。

## 方式一：Docker

需要 Docker Desktop 或兼容的 Docker Engine。复制端口配置并启动：

```bash
cp .env.example .env
docker compose up --build
```

打开 <http://127.0.0.1:3015>。如需改端口，修改 `.env` 中的 `DASHBOARD_PORT`；服务仍只绑定宿主机 `127.0.0.1`。

数据文件位于项目目录的 `data/dashboard.sqlite3`，通过 `./data:/app/data` 挂载到容器。停止、再次启动或重启应用不会删除它：

```bash
docker compose stop
docker compose start
docker compose restart app
```

停止并移除容器：

```bash
docker compose down
```

不要使用 `docker compose down -v` 清理本地数据。

## 方式二：直接运行

需要 Node.js 24.18.0（可运行 `nvm use` 切换）：

```bash
npm ci && npm run db:migrate && npm run dev
```

打开 <http://127.0.0.1:3015>。开发模式下，前端在 `3015`，本地 API 在 `3016`；按 `Ctrl+C` 停止两者。数据同样写入 `data/dashboard.sqlite3`，再次运行 `npm run dev` 即可重启。

## 可选演示数据

空数据库是正常状态。若想预览布局，可随时执行：

```bash
npm run seed:demo
```

Docker 中执行：

```bash
docker compose exec app node server/cli/seed-demo.mjs
```

演示数据的 ID 都以 `demo:` 开头，标题包含“示例”或“演示”，内容完全虚构。该命令只新增或更新这些固定的演示 ID，不会覆盖其他本地记录。

## 备份

最稳妥的方式是先停止应用，再复制数据库文件以及存在的 SQLite sidecar：

```bash
docker compose stop
mkdir -p backups
cp data/dashboard.sqlite3 backups/dashboard.sqlite3
for sidecar in data/dashboard.sqlite3-wal data/dashboard.sqlite3-shm; do
  if [ -f "$sidecar" ]; then cp "$sidecar" backups/; fi
done
```

直接运行时先按 `Ctrl+C`，再执行同样的复制命令。恢复前也要停止应用，并保留同一备份时间点的 `dashboard.sqlite3`、`-wal` 和 `-shm` 文件。

应用在线时，不要直接复制正在变化的文件；可使用本机 SQLite CLI 的一致性备份命令：

```bash
mkdir -p backups
sqlite3 data/dashboard.sqlite3 ".backup 'backups/dashboard-live.sqlite3'"
```

## Self 导入与离线说明

Self 导入命令将在 **Plan 2 完成后** 才会提供；当前版本还没有该命令，不要将演示 seed 当作真实内容导入。

镜像构建和首次 `npm ci` 可能需要下载依赖；构建完成后的应用运行只读取本机镜像与 `./data`，不需要云账号、云凭证或网络连接。项目不接入云数据库，也不需要外部服务凭证。
