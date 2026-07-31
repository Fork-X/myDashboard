# SDD Progress
目标：独立 Node + React + SQLite 看板；Self 仅一次导入；最终发布为单根提交私有仓库。
顺序：Plan 1（7 项）→ Plan 2（5 项）→ Plan 3（6 项）→ 全分支审查与最终验收。
工作区：`codex/local-sqlite-migration` @ `9b16798`，隔离 worktree，启动时 clean。
任务 0：完成；Node v25.8.1，npm test 缺失，typecheck 16 个 TS2353，build 成功但 3 警告/806 KiB。
硬门槛：每项 RED→GREEN、单提交、规格与质量双审通过后才进入下一项。
最大风险：隐私泄漏、旧 Git 历史误推、Self 导入非原子、SQLite 数据未持久化。
发布阻塞预期：GitHub token 当前无效；到 Plan 3 Task 4 才处理认证，不接触旧远端。
Plan 1 Task 1：完成（提交 69ec90d..3a7b25a；规格/质量审查通过；RED=ERR_MODULE_NOT_FOUND，GREEN=1/1）。
Plan 1 Task 2：完成（提交 3a7b25a..929bd3f；双审通过；RED=2 个缺失模块，GREEN=3/3 DB tests，skip=0）。
Minor 待终审复核：Task 2 未直接覆盖 upsertTasks 与 records 冲突更新回归；当前实现未发现缺陷。
Plan 1 Task 3：完成（提交 929bd3f..e61e1d1；2 个 Important 修复复审通过；full 7/7，skip=0；fresh migrate=Applied）。
Minor 待终审复核：Task 3 HTTP 测试有非阻塞 setup/cleanup 重复。
Plan 1 Task 4：完成（提交 e61e1d1..f0255ba；3 个 Important 修复复审通过；contract 5/5，full 12/12，typecheck/build 通过）。
Minor 待终审复核：动态 domain 首帧仍可能短暂暴露旧 state；Date.parse 会宽松接受部分非法日期。
Plan 1 Task 5：完成（提交 f0255ba..1acb94a；3 个 Important 修复复审通过；focused 10/10，full 22/22，typecheck/build 通过）。
Minor 待终审复核：Todo UI gate/unmount 仍为源码契约测试；Task 5 report 主体保留被 appendix 取代的旧数字/语义。
Plan 1 Task 6：完成（提交 1acb94a..9158ce3；审查通过；full 23/23，typecheck/build 通过；两项原样扫描 0 命中）。
非阻塞 concern：计划指定依赖图的 npm audit 为 4 moderate/5 high；需另行依赖决策，未在本 Task 擅自升级。
Plan 1 Task 7：完成（提交 9158ce3..4cd4375；双审通过；full 24/24，skip=0；typecheck/build/Docker build/health/seed/restart/持久化通过）。
Plan 1 完成门：空库真实 API 返回 records/tasks 空数组；Docker 验收使用 39115，停止后宿主 SQLite 仍保留 demo 行。
Minor 待终审复核：Task 7 运行镜像仍包含 `server/**/*.test.mjs`，不影响运行与隐私扫描。
Plan 2 Task 1：完成（提交 a3ac334..bae0e43；双审通过；RED=ERR_MODULE_NOT_FOUND；focused 2/2，full 26/26，skip=0；typecheck/build 通过）。
Minor 待终审复核：临时 v2 fixture 的 `mkdir` 位于 `try` 前；未逐一覆盖 topics/projects v2 与三类非数组输入。
下一项：Plan 2 Task 2 — Add the ignored local privacy mapping boundary。
