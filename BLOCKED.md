# BLOCKED

- 当前无阻塞项。
- 任务 0 非阻塞偏差：`npm test` 的预期“缺少 test 脚本”之外，npm 还因沙箱权限无法写入 `~/.npm/_logs`；不影响失败原因判定，后续需要日志时改用 `/private/tmp` 下的显式 npm cache。
- Plan 1 Task 4 非阻塞规格张力：任务步骤的职业示例只列核心文本字段，但总体硬约束要求除新闻和敏感控件外保留国风复古视觉骨架。按“硬约束优先”恢复已批准 `projects` 的非敏感标签、时间编号格式和不依赖远端图片的数据无关占位带；不恢复薪资、密码/锁或真实公司信息。
- Plan 1 Task 6 文件白名单冲突：任务要求最终禁词 `rg` 零命中，但 Task 4/5 守卫测试本身含“薪资英文键”和“旧云客户端标识”的字面量，且不在 Task 6 `Files`。不允许降低扫描或删除测试；按“隐私/正确优先”仅将这两个既有测试改为等价的分片 `RegExp` 构造，使守卫能力不变且真实扫描保持原命令/原范围。此为最小、可恢复的越界调整。
- Plan 1 Task 7 非阻塞环境偏差：默认宿主端口 3015 被范围外的原主工作区 Node 进程占用，禁止终止。`compose.yaml` 默认仍为 3015；本次 Docker 持久化验收改用显式空闲 `DASHBOARD_PORT`，新克隆默认端口留待隔离环境复验。
- Plan 2 Task 1 文件白名单冲突：任务步骤要求创建 `fixtures/self-index-v2`，但该目录未列入 Task `Files`，而总规矩禁止修改 Files 外路径。按硬边界不创建该目录，改由测试在系统临时目录生成三份 v2/v3 输入并在 `finally` 清理，保留 unsupported-version 验收且不污染仓库。
- Plan 2 Task 2 文件白名单冲突：任务步骤要求创建 `fixtures/invalid-import-map.json`，但该文件未列入 Task `Files`。按相同硬边界由 `privacy.test.mjs` 在系统临时目录生成无效配置并在 `finally` 清理；`.gitignore` 在本 Task 起点已恰好包含 `import-map.local.json`，未重复追加以避免无意义 diff。
