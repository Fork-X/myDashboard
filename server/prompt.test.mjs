import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPrompt, stripFrontmatter, PROMPT_VARIABLES } from './prompt.mjs';

test('renderPrompt 替换全部已声明变量', () => {
  const out = renderPrompt(
    '板块：{{domainName}}\n题材：{{directionName}}\n日期：{{today}}',
    { domainName: '航天', directionName: '商业航天', today: '2026-08-14' },
  );
  assert.equal(out, '板块：航天\n题材：商业航天\n日期：2026-08-14');
});

test('renderPrompt 容忍变量两侧空格', () => {
  const out = renderPrompt('{{ domainName }}', { domainName: '化工' });
  assert.equal(out, '化工');
});

test('renderPrompt 重复出现的变量全部替换', () => {
  const out = renderPrompt('{{keywords}} / {{keywords}}', { keywords: '卫星' });
  assert.equal(out, '卫星 / 卫星');
});

test('renderPrompt 对未知变量报错并提示可用清单', () => {
  assert.throws(
    () => renderPrompt('{{directionNam}}', { directionName: 'x' }, 'stock/prompt.md'),
    (err) => err.message.includes('stock/prompt.md')
      && err.message.includes('{{directionNam}}')
      && err.message.includes('directionName'),
  );
});

test('renderPrompt 对缺失取值报错', () => {
  assert.throws(
    () => renderPrompt('{{sources}}', {}, 'aerospace/prompt.md'),
    /aerospace\/prompt\.md 需要变量 \{\{sources\}\}/,
  );
});

test('renderPrompt 允许空字符串作为取值', () => {
  assert.equal(renderPrompt('[{{description}}]', { description: '' }), '[]');
});

test('renderPrompt 不改动无变量的模板', () => {
  const template = '# 纯文本\n没有任何占位符。';
  assert.equal(renderPrompt(template, {}), template);
});

test('renderPrompt 整块删除 HTML 注释，注释里的变量不参与替换', () => {
  // 回归：注释块用于给人写变量说明，若被当成真变量替换，会把整个信源
  // 内容塞进注释里，导致 prompt 体积翻倍且结构错乱。
  const template = [
    '<!--',
    '可用变量：',
    '  {{domainName}}  板块名',
    '  {{sources}}     信源内容',
    '-->',
    '',
    '板块：{{domainName}}',
  ].join('\n');

  const out = renderPrompt(template, { domainName: '航天', sources: '巨量文本' });
  assert.equal(out, '板块：航天');
  assert.doesNotMatch(out, /可用变量/);
  assert.doesNotMatch(out, /巨量文本/);
});

test('renderPrompt 注释里的未知变量不会触发报错', () => {
  const out = renderPrompt('<!-- {{完全不存在的变量}} -->\n正文', {});
  assert.equal(out, '正文');
});

test('renderPrompt 删除多个分散的注释块', () => {
  const out = renderPrompt('<!--A-->第一段\n<!--B-->第二段', {});
  assert.equal(out, '第一段\n第二段');
});

test('PROMPT_VARIABLES 是冻结的且包含核心变量', () => {
  assert.ok(Object.isFrozen(PROMPT_VARIABLES));
  for (const name of ['domainName', 'directionName', 'sources', 'today', 'ambushDays']) {
    assert.ok(PROMPT_VARIABLES.includes(name), `缺少变量 ${name}`);
  }
});

test('stripFrontmatter 去掉 YAML 头部', () => {
  const out = stripFrontmatter('---\nname: stock-scan\nversion: 1\n---\n# 正文\n内容');
  assert.equal(out, '# 正文\n内容');
});

test('stripFrontmatter 对无 frontmatter 的内容原样返回', () => {
  const text = '# 正文\n内容';
  assert.equal(stripFrontmatter(text), text);
});

test('stripFrontmatter 对未闭合的 frontmatter 原样返回', () => {
  const text = '---\nname: broken\n# 没有结束标记';
  assert.equal(stripFrontmatter(text), text);
});
