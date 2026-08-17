# 开发日志（DEVLOG）

> 精简记录：已完善的功能点 / 半成品与待改进项。每次完成一批改动后追加或勾销。
> 架构细节见 [ARCHITECTURE.md](./ARCHITECTURE.md)，扫描链路操作手册见 [SCAN-PIPELINE.md](./SCAN-PIPELINE.md)。

## 已完善 ✅

### 基础功能域（稳定）
- 想法 / 待办四象限 / 目标进度 / AI 对话（SSE 流式 + 排队状态透出 + 认证过期提示）/ 对话提炼想法
- 投资域：事件 CRUD、阶段时间轴（潜伏/准备/事件期）、题材管理、AI 收件箱（确认/编辑/忽略 → 转事件）

### 扫描链路（2026-08 重构，已端到端验证）
- **asset/ 策略层继承模型**：`_default/` 缺省仓库 + 四板块（航天/化工/机器人/半导体）只写差异项；遗留键 `stock` 兼容存量数据
- **纯信源模式**：只从 RSS 提取、禁用联网搜索（内网 WebSearch 会挂死，实测 29.5s vs 挂死 17 分钟+）；prompt 统一在 `_default/prompt.md`，改一处全板块生效
- **信源**：全部为实测可达的原生 RSS（东财 99 条、华尔街见闻 60 条、SpaceNews 等）；通用信源自动继承 + 板块专属合并去重
- **保护机制**：prompt 变量写错直接报错；AI 调用 10 分钟超时；CLI stderr 透出；排队/工具调用实时日志；单条坏数据不拖垮整批
- **可核对性**：`npm run scan:dry`（空跑不花钱）；每次扫描的最终 prompt 落盘 `data/last-prompt/`
- 177 个测试通过；`tsc --noEmit` 干净

## 半成品 / 待改进 🚧

| # | 事项 | 现状 | 影响 |
|---|---|---|---|
| 1 | **ambushDays 未落数据** | 板块埋伏期只进 prompt；收件箱转事件时 `convertInboxItem` 硬编码 60 天 | 化工(30)/机器人(45)的板块定制在事件层不生效 |
| 2 | **确定型日历事件通道** | 未开始。方案已验证：东财 datacenter JSON API（`RPT_LIFT_STAGE` 解禁等）直取，不经 AI | 解禁日/财报预约日这类信息目前只能靠信源新闻碰运气 |
| 3 | **机器人板块无专属信源** | 只用继承的通用财经源 + 关键词过滤；候选 URL 全部 403（见 sources.yaml 注释） | 该板块召回弱于其他板块 |
| 4 | **RSS 偶发失败被静默吞** | `fetchSource` 失败只 warn 一行、返回空数组；并发时偶发 0 条（重跑即恢复） | 可能悄悄用残缺信源扫描而无感知 |
| 5 | **扫描无结构化运行日志** | 各阶段计数（抓几条/解析几条/入库几条）只在 console，未落库 | 事后无法追溯某次扫描为何空 |
| 6 | **WebSearch 恢复开关是手工的** | 回家庭网络需手改 `_default/prompt.md` 第 2 条（文件注释里有原文） | 切换环境要记得改 |
| 7 | **domain 配置改动需重启** | 板块配置启动时缓存 | 改 asset/ 后必须重启服务 |
| 8 | **收件箱不展示 domain** | 数据已写入 `inbox_items.domain`，前端未展示 | 多板块条目混在一起时不好分辨 |
| 9 | Career / Projects 页面 | 占位（ComingSoon） | — |

## 明确不做（MVP 边界）

- 买卖操作记录、盈亏统计/数据分析、提醒通知
- 扫描效果评测体系（golden set / 召回率回放）——2026-08-15 决定暂缓，先做核心功能
- MCP 工具化信源（确定性拉取用代码直调，不交给模型决策）

## 变更记录

- **2026-08-15 (4)**：distill skill 迁入仓库 `skills/distill/`，distiller 改为读文件注入 systemPrompt（与扫描链路同款，彻底去除 .qoder/ 依赖与 SDK Skill 机制），删除 .gitignore 白名单 hack；自此项目内所有 skill 均为仓库文件 + 代码注入，与具体 agent 无关
- **2026-08-15 (3)**：删除 sourcesJson 题材级信源覆盖（迁移 005 删列 + DB/API/pipeline/前端全链路移除），信源收敛为唯一来源 asset/ 继承模型；真实库已应用
- **2026-08-15 (2) 过度设计清理**：删 fetcher 的 api/webpage 投机解析器与 matchAll polyfill（收敛为纯 RSS）；删未被任何逻辑消费的 outputType 字段与 sources.yaml 的 priority 字段；删 scanner.mjs 薄壳（index 直连 pipeline，测试随迁 pipeline.test.mjs）；修复 distill skill 被 gitignore 导致换机后提炼功能必坏的问题（.gitignore 白名单）；重写过时的 README 并同步 fresh-start 守护测试；旧设计稿归档到 docs/archive/；177 测试
- **2026-08-15 (1)**：asset/ 继承重构（`_default/` + 差异项）；全板块统一纯信源模式；「商业航天」改判 aerospace；去掉"默认"伪板块；AI 调用超时 + stderr 透出；scan:dry 工具
- **2026-08-14**：prompt.mjs 组装模块（变量强校验/注释剔除/落盘）；skill 改 systemPrompt 注入（弃用 .qoder/skills 拷贝）；信源换实测可用原生 RSS；定位内网 WebSearch 挂死根因
- **2026-08-12**：板块化架构落地（fetcher/pipeline/迁移 004/前端板块选择）；对抗性审查发现 rsshub 全挂与 skill 未激活两个 P0
- 更早：投资域 MVP 五步实现、AI 对话可观测性增强、模型收敛 Kimi-K3（见 ARCHITECTURE.md）
