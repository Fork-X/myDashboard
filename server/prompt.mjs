/**
 * prompt — prompt 组装
 *
 * 设计前提：prompt 是策略，会被频繁手改，所以内容全部住在
 * asset/{板块}/ 下的两个 Markdown 文件里，本模块不拼接任何业务文案。
 *
 *   skill.md   → systemPrompt   角色与方法论（稳定，"怎么想"）
 *   prompt.md  → user prompt    本次任务与输出格式（每次渲染，"这次做什么"）
 *
 * 本模块只负责三件事：变量替换、替换后的强校验、把最终 prompt 落盘供人工核对。
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * prompt.md 里允许使用的变量。
 *
 * 这是唯一的变量清单：新增变量必须先加到这里，否则 prompt.md 里写了会直接报错。
 * 反之，prompt.md 里写错变量名（如 {{directionNam}}）也会报错而不是静默留下原文。
 */
export const PROMPT_VARIABLES = Object.freeze([
  'domainName',      // 板块名，如「航天」
  'directionName',   // 题材名，如「商业航天」
  'description',     // 题材描述
  'keywords',        // 题材关键词
  'sources',         // 抓取到的信源内容（已格式化的 Markdown 列表）
  'today',           // 当前日期 YYYY-MM-DD
  'ambushDays',      // 该板块的埋伏天数
]);

const PLACEHOLDER = /\{\{\s*([\w]+)\s*\}\}/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/**
 * 渲染 prompt 模板。
 *
 * HTML 注释先被整块删除：模板顶部的变量说明是写给人看的，既不应该被
 * 当成真变量替换（否则会把整个信源内容塑进注释里），也不应该消耗 token。
 *
 * 对未知变量与缺失变量都直接抛错——手改 prompt 时打错字必须立刻可见，
 * 否则错误会以「{{directionNam}}」的字面量形式混进 prompt，静默劣化结果。
 *
 * @param {string} template  prompt.md 原文
 * @param {Record<string, unknown>} vars
 * @param {string} [label]   出错信息里用于定位的文件名
 * @returns {string}
 */
export function renderPrompt(template, vars, label = 'prompt.md') {
  const body = template.replace(HTML_COMMENT, '').trim();
  const allowed = new Set(PROMPT_VARIABLES);
  const used = new Set();

  for (const [, name] of body.matchAll(PLACEHOLDER)) {
    if (!allowed.has(name)) {
      throw new Error(
        `${label} 使用了未知变量 {{${name}}}。可用变量：${PROMPT_VARIABLES.join(', ')}`,
      );
    }
    used.add(name);
  }

  for (const name of used) {
    if (vars[name] === undefined || vars[name] === null) {
      throw new Error(`${label} 需要变量 {{${name}}}，但渲染时未提供该值`);
    }
  }

  return body.replace(PLACEHOLDER, (_, name) => String(vars[name]));
}

/**
 * 读取 skill.md 作为 systemPrompt。
 *
 * 剥掉 YAML frontmatter——那是给 Skill 工具用的元数据，注入模型只是噪音。
 *
 * @param {string} dir  板块目录
 * @param {string} [fileName]
 * @returns {Promise<string>}
 */
export async function loadSystemPrompt(dir, fileName = 'skill.md') {
  const raw = await readFile(resolve(dir, fileName), 'utf-8');
  return stripFrontmatter(raw).trim();
}

/** 去掉开头的 `---\n...\n---\n` 块。 */
export function stripFrontmatter(text) {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return text;
  return text.slice(text.indexOf('\n', end + 1) + 1);
}

/**
 * 把本次实际发给模型的内容落盘，供人工核对 prompt 改动效果。
 *
 * 每个题材固定一个文件、直接覆盖，不累积历史，无需清理。
 *
 * @returns {Promise<string|null>} 写入路径，失败时返回 null（不影响扫描）
 */
export async function dumpPrompt({ dir, directionId, systemPrompt, userPrompt }) {
  try {
    await mkdir(dir, { recursive: true });
    const path = resolve(dir, `${directionId}.md`);
    await writeFile(path, [
      '# systemPrompt（来自 skill.md）',
      '',
      systemPrompt || '（空）',
      '',
      '# userPrompt（来自 prompt.md，变量已替换）',
      '',
      userPrompt,
      '',
    ].join('\n'));
    return path;
  } catch {
    return null;
  }
}
