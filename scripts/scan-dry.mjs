/**
 * scan:dry — 空跑扫描管道，不调用 AI。
 *
 * 用途：改完 asset/{板块}/ 配置后，立刻确认
 *   1. 信源能不能抓到内容、抓到几条、耗时多少（含继承的通用信源）
 *   2. 变量有没有写错（写错会直接报错）
 *   3. 最终发给模型的 prompt 长什么样、多大
 *
 * 用法：
 *   npm run scan:dry              # 空跑所有板块
 *   npm run scan:dry -- aerospace # 只跑指定板块
 *
 * 板块发现/信源合并/文件回落逻辑直接复用 pipeline.mjs 的导出，与真实扫描一致。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchAllSources, formatSourcesForPrompt } from '../server/fetcher.mjs';
import { renderPrompt } from '../server/prompt.mjs';
import {
  discoverDomains,
  resolveDomainSources,
  resolvePromptTemplate,
  resolveSystemPrompt,
} from '../server/pipeline.mjs';

const ASSET_DIR = resolve('asset');
const OUT_DIR = resolve('data', 'dry-run');
const only = process.argv[2];

const { domains, defaultDomain } = await discoverDomains(ASSET_DIR);
const targets = only ? domains.filter((d) => d.key === only) : domains;

if (targets.length === 0) {
  console.error(only ? `未找到板块 "${only}"（可用: ${domains.map((d) => d.key).join(', ')}）` : '未找到任何板块');
  process.exit(1);
}
if (defaultDomain) {
  console.log(`_default 缺省配置已加载（遗留键 "${defaultDomain.key}" 解析到它）`);
}

await mkdir(OUT_DIR, { recursive: true });
let failed = 0;

for (const domain of targets) {
  console.log(`\n${'═'.repeat(64)}\n板块：${domain.name} (${domain.key})  埋伏期=${domain.ambushDays}天  扫描间隔=${domain.scanIntervalHours}h\n${'═'.repeat(64)}`);

  // 1. 信源（通用 + 板块专属合并后）
  const sources = await resolveDomainSources(domain, defaultDomain);
  console.log(`\n[信源] 合并后共 ${sources.length} 个：`);
  for (const s of sources) console.log(`   • ${s.name}  ${s.url}  (maxItems=${s.maxItems})`);

  let sourceText = '（无信源内容）';
  if (sources.length > 0) {
    const t0 = Date.now();
    const results = await fetchAllSources(sources);
    console.log(`\n[抓取] 耗时 ${Date.now() - t0}ms`);
    for (const { source, items } of results) {
      const mark = items.length > 0 ? '✓' : '✗';
      console.log(`   ${mark} ${source.name}: ${items.length} 条`);
      if (items.length > 0) console.log(`      首条: ${items[0].title.slice(0, 50)}`);
      if (items.length === 0) failed++;
    }
    sourceText = formatSourcesForPrompt(results) || '（无信源内容）';
  }

  // 2. 渲染 prompt（变量写错会在这里抛错；缺失文件自动回落 _default）
  try {
    const template = await resolvePromptTemplate(domain, defaultDomain);
    const userPrompt = renderPrompt(template, {
      domainName: domain.name,
      directionName: '【空跑样例题材】',
      description: '【空跑样例描述】',
      keywords: '【空跑样例关键词】',
      sources: sourceText,
      today: new Date().toISOString().slice(0, 10),
      ambushDays: String(domain.ambushDays ?? 60),
    }, `${domain.key}/prompt.md`);

    const systemPrompt = await resolveSystemPrompt(domain, defaultDomain);

    const out = resolve(OUT_DIR, `${domain.key}.md`);
    await writeFile(out, [
      `# systemPrompt（skill.md，${systemPrompt.length} 字符）`, '', systemPrompt || '（空）', '',
      `# userPrompt（prompt.md 已渲染，${userPrompt.length} 字符）`, '', userPrompt, '',
    ].join('\n'));

    const total = systemPrompt.length + userPrompt.length;
    console.log(`\n[prompt] ✓ 变量校验通过`);
    console.log(`   systemPrompt ${systemPrompt.length} 字符 / userPrompt ${userPrompt.length} 字符`);
    console.log(`   合计 ${(total / 1024).toFixed(1)} KB ≈ ${Math.round(total / 1.7)} tokens（粗估）`);
    console.log(`   完整内容 → ${out}`);
  } catch (err) {
    console.log(`\n[prompt] ✗ ${err.message}`);
    failed++;
  }
}

console.log(`\n${'═'.repeat(64)}`);
console.log(failed === 0 ? '全部通过。' : `完成，但有 ${failed} 项异常（见上方 ✗）。`);
