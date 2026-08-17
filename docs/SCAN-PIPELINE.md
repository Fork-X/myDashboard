# 扫描链路：架构、生命周期与策略修改指南

> **维护约定：任何影响扫描链路的代码/配置改动，必须同步更新本文档与 `ARCHITECTURE.md` 的相关小节。**
> 本文档回答三个问题：系统何时加载什么内容；哪些环节需要人介入；哪些文件是"你的策略"、如何安全地修改。

## 1. 三层结构

```
┌─ 策略层（人改的）────────────────────────────────────┐
│  asset/_default/  缺省仓库（不出现在板块列表）：        │
│    domain.json    全量缺省参数（key=stock 兼容存量）    │
│    sources.yaml   通用财经信源（所有板块自动继承）      │
│    prompt.md      统一的任务与输出格式模板              │
│    skill.md       通用角色设定                          │
│  asset/{板块}/    只写差异项，缺的自动回落 _default：    │
│    domain.json    名称/埋伏期/扫描频率（覆盖缺省值）     │
│    sources.yaml   板块专属信源（与通用信源合并去重）     │
│    skill.md       板块判断口味（关注范围/筛选原则）      │
└──────────────┬───────────────────────────────────────┘
               │ 启动时/扫描时读取
┌─ 引擎层（一般不碰）───────────────────────────────────┐
│  server/pipeline.mjs   编排 + 板块发现/继承解析：         │
│                        抓信源→拼prompt→调AI→写收件箱     │
│  server/fetcher.mjs    抓 RSS/Atom，压缩成摘要           │
│  server/prompt.mjs     变量替换 + 写错变量直接报错       │
└──────────────┬───────────────────────────────────────┘
               │ 读写
┌─ 数据层（系统写，人在 UI 里操作）──────────────────────┐
│  SQLite:  directions(题材) → inbox_items(收件箱)       │
│           → events(事件) → 时间线                      │
│  data/last-prompt/   每次实际发给模型的 prompt 快照     │
│  data/dry-run/       scan:dry 空跑产物                 │
└──────────────────────────────────────────────────────┘
```

当前板块：`aerospace`（航天，埋伏 60 天）、`chemical`（化工，30 天）、`robotics`（机器人，45 天）、`semiconductor`（半导体，60 天）。
存量数据里的遗留板块键 `stock` 解析到 `_default`（仍可扫描），但 UI 新建题材必须选真实板块。

## 2. 一次扫描的生命周期（何时加载什么）

以「商业航天」题材被扫描为例：

| 时机 | 发生什么 | 内容来源 |
|---|---|---|
| **服务启动** | 扫描 `asset/`，读所有 `domain.json` 并缓存板块清单（改配置需重启）；启动 5 分钟轮询 | `asset/*/domain.json` |
| **轮询到期 / 手动点扫描** | 从 DB 读题材（名称/描述/关键词/所属板块），并发锁防止同题材重入 | `directions` 表 |
| ① 抓信源 | 合并 `_default` 通用信源与板块专属信源（按 URL 去重），并行拉 RSS，压缩成「标题+链接+300字摘要」（约 1.4MB 原文 → 11KB） | 两层 `sources.yaml` |
| ② 拼 prompt | `prompt.md` 做变量替换（板块无自己的则用 `_default` 的）；`skill.md` 剥掉 frontmatter 后作为 systemPrompt 注入（同样支持回落） | `prompt.md` + `skill.md` |
| ③ 留证据 | 最终发给模型的完整内容写入 `data/last-prompt/{题材id}.md`（覆盖式，每题材一份） | 引擎自动 |
| ④ 调 AI | systemPrompt + userPrompt 发给模型；受 `maxTurns` / `allowedTools` / `timeoutMinutes`（默认 10 分钟超时）约束 | `domain.json` |
| ⑤ 解析入库 | 分级提取 JSON（代码块 → 括号配平），逐条校验，合格条目写入收件箱（status=pending），坏条目丢弃不拖垮整批 | `inbox_items` 表 |
| **人工确收** | Inbox 页逐条「确认（可编辑）/ 忽略」，确认的转成正式事件 | UI |
| 之后 | 事件进时间线，按埋伏期显示 潜伏/准备/事件 阶段 | `events` 表 |

## 3. 策略文件：改什么、何时改

四类文件构成全部策略面，按改动频率排序：

| 文件 | 决定什么 | 什么时候改 |
|---|---|---|
| **sources.yaml** | AI 看到什么原材料。**召回率的根**——信源没覆盖，AI 再聪明也是无米之炊。板块文件只写专属源，通用源写在 `_default/` | 发现漏事件（先查 last-prompt 里信源有没有那条新闻） |
| **skill.md**（每板块） | 角色与筛选原则（如"商业航天优先于科研任务"）——板块的**判断口味** | 想调某板块提取的侧重点 |
| **_default/prompt.md** | 所有板块共用的任务指令与输出格式（当前为纯信源模式：禁用工具/联网） | 提取质量差、格式跑偏；内网↔家庭网络切换 |
| **domain.json** | `ambushDays` 埋伏天数、`scanIntervalHours` 扫描间隔；`_default/` 的还有 `maxTurns`/`allowedTools`/`timeoutMinutes` | 板块节奏变化 |

需要某板块完全自定义任务模板时，在该板块目录新建 `prompt.md` 即可覆盖继承。

### prompt.md 的保护机制

- 可用变量以 `server/prompt.mjs` 的 `PROMPT_VARIABLES` 为唯一清单：
  `domainName` / `directionName` / `description` / `keywords` / `sources` / `today` / `ambushDays`
- 写错变量名（如 `{{directionNam}}`）**直接报错**并列出可用清单，不会静默留下原文劣化结果
- `<!-- -->` 注释块发给模型前被整块删除：说明文字随便写，不占 token，注释里的 `{{变量}}` 也不参与替换

### 修改后的验证闭环（必做）

```
改文件
  → npm run scan:dry              # 空跑全部板块（3 秒，不调 AI 不花钱）
  → npm run scan:dry -- aerospace # 或只跑某板块
     检查：信源抓到几条？变量校验过没过？prompt 多大？
  → 打开 data/dry-run/{板块}.md    # 亲眼读一遍最终 prompt（数字对不代表内容对）
  → UI 手动触发一次真实扫描        # 看收件箱条目质量
```

## 4. 人工介入点（只有两处）

1. **收件箱确收**——AI 只有投递权没有入账权，事件进不进时间线由人决定
2. **策略文件维护**——上面四个文件

其余（抓取、拼装、解析、去重、轮询、超时终止）全自动，失败记日志不崩服务。

## 5. 已验证的环境约束（改配置前必读）

| 事实 | 证据 | 对策 |
|---|---|---|
| **公司内网下 WebSearch 会挂死连接**（不报错也不返回），或快速失败重试 | 三档对照探针：短 prompt 9s 成功；发起 WebSearch 后 10+ 分钟零消息 | 内网跑时 prompt.md 用纯信源模式（"不要使用任何工具"）；引擎侧有 10 分钟超时兜底（504 报错并指出卡在哪个工具） |
| 内网无法访问 rsshub.app（全部超时） | 11/11 URL 实测 000 | sources.yaml 只用原生 RSS（网站自己发布的 feed，直连站点）；不可用的源以注释保留在各 sources.yaml 里 |
| Kimi-K3 慢队列排队可达 100 秒+ | 探针实测 queue_count≈980、等待 102s | 扫描耗时波动大属正常；日志会打印排队进度 |
| `maxTurns` 不等于消息轮数上限 | 设 2 实测 turns=6（工具失败重试不计入） | 不要依赖 maxTurns 控制成本上限，靠 timeoutMinutes 兜底 |
| SDK 的 `skills: []` 是"显式禁用全部 skill"而非"默认" | SDK 源码合并逻辑 + 探针验证 | 引擎已改为 skill.md 直接注入 systemPrompt，不再使用 SDK Skill 工具，不依赖 `.qoder/skills/` |
| RSS 并发抓取存在偶发静默失败 | 半导体源一次 0 条，重跑正常 | scan:dry 出现 ✗ 时先重跑一次再排查 |

### 内网 ↔ 家庭网络切换

- 在家跑时可恢复搜索：把 `_default/prompt.md` 任务区第 2 条换回「信源覆盖不足时，再用 WebSearch 补充搜索未来 1–3 个月可能发生的事件」（文件内注释里留了原文），改一处全部板块生效
- 回家后可实测 rsshub.app 是否可达，可用则往各板块 sources.yaml 增补财联社电报、微博等无原生 RSS 的中文源（各文件注释里已留候选 URL）

## 6. 排查入口速查

| 症状 | 先看哪里 |
|---|---|
| 收件箱没结果 | `data/last-prompt/{题材id}.md`——AI 到底看到了什么 |
| 怀疑信源断了 | `npm run scan:dry`，看每个源抓到几条 |
| 扫描很慢 | 服务日志的「排队中」行（平台算力排队，非本地问题） |
| 扫描报 504 | 日志「调用工具」行——大概率内网卡在 WebSearch |
| 扫描报 502 | 报错里带 CLI stderr 最后 5 行 |
| 改了 prompt 报变量错误 | 对照 `server/prompt.mjs` 的 `PROMPT_VARIABLES` 清单 |

## 7. 已知欠账（待办详见 [DEVLOG.md](./DEVLOG.md)）

- `domain.json` 的 `ambushDays` 只进 prompt，收件箱转事件时仍硬编码 60 天（`convertInboxItem`）
- 确定型日历事件（解禁日/财报预约披露日）计划走东财 datacenter JSON API 直取，不经过 AI（已实测可用：`RPT_LIFT_STAGE` 等 reportName）
- 机器人板块缺可用的行业专属中文 RSS，暂靠继承的通用财经源 + 题材关键词过滤
- RSS 并发抓取的偶发失败被 `fetchSource` 静默吞掉，缺失败原因日志
