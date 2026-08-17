<!--
可用变量（改动前请先看 server/prompt.mjs 的 PROMPT_VARIABLES）：
  {{domainName}}     板块名，如「航天」
  {{directionName}}  题材名，如「商业航天」
  {{description}}    题材描述
  {{keywords}}       题材关键词
  {{sources}}        抓取到的信源内容
  {{today}}          当前日期 YYYY-MM-DD
  {{ambushDays}}     本板块埋伏天数

写错变量名会直接报错，不会静默留下原文，放心改。
角色设定与筛选原则写在同目录的 skill.md 里。
-->

当前日期：{{today}}

## 扫描题材

- 板块：{{domainName}}
- 名称：{{directionName}}
- 描述：{{description}}
- 关键词：{{keywords}}

## 已抓取的信源内容

{{sources}}

## 你的任务

1. 从上面的信源内容里提取符合本题材的投资事件。
2. 只基于信源内容作答，**不要使用任何工具、不要联网搜索**。信源里没有的事件就不输出。
3. 只输出信源里**明确写出**的事件与日期，不要推测。

<!--
内网模式说明：公司内网下 WebSearch 会挂死连接（实测），故禁用搜索。
在家里跑时可把第 2 条换回：「信源覆盖不足时，再用 WebSearch 补充搜索
未来 1–3 个月可能发生的事件。」
-->

## 输出格式

返回一个 JSON 数组，每个元素形如：

```json
{
  "sourceSummary": "原始新闻摘要，保留关键事实和数字",
  "sourceUrl": "来源链接，无法确定时填空字符串",
  "aiEventName": "简短事件名称，15 字以内",
  "aiEventStartDate": "YYYY-MM-DD，模糊日期取区间中间值",
  "aiEventEndDate": "YYYY-MM-DD，单日事件与 startDate 相同",
  "dateConfidence": "exact 或 fuzzy",
  "aiTags": ["标签1", "标签2"],
  "aiTickers": [{ "symbol": "股票代码", "name": "股票名称" }]
}
```

只返回 JSON 数组本身，不要任何解释文字。没有找到事件时返回 `[]`。

参考：本板块埋伏周期为事件发生前 {{ambushDays}} 天。
