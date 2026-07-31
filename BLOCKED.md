# BLOCKED

- 当前无阻塞项。
- 任务 0 非阻塞偏差：`npm test` 的预期“缺少 test 脚本”之外，npm 还因沙箱权限无法写入 `~/.npm/_logs`；不影响失败原因判定，后续需要日志时改用 `/private/tmp` 下的显式 npm cache。
