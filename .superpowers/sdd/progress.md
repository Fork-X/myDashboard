# SDD Progress
目标：独立 Node + React + SQLite 看板；Self 仅一次导入；最终发布为单根提交私有仓库。
顺序：Plan 1（7 项）→ Plan 2（5 项）→ Plan 3（6 项）→ 全分支审查与最终验收。
工作区：`codex/local-sqlite-migration` @ `9b16798`，隔离 worktree，启动时 clean。
任务 0：完成；Node v25.8.1，npm test 缺失，typecheck 16 个 TS2353，build 成功但 3 警告/806 KiB。
硬门槛：每项 RED→GREEN、单提交、规格与质量双审通过后才进入下一项。
最大风险：隐私泄漏、旧 Git 历史误推、Self 导入非原子、SQLite 数据未持久化。
发布阻塞预期：GitHub token 当前无效；到 Plan 3 Task 4 才处理认证，不接触旧远端。
下一项：Plan 1 Task 1 — SQLite schema and migration runner。
