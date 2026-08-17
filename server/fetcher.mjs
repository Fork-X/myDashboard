/**
 * fetcher — 信源内容抓取器
 *
 * 纯函数模块，从 RSS/Atom feed 抓取内容，不落盘、不依赖数据库。
 * 只支持 rss 类型；确定型 JSON API（如东财解禁日历）属于另一条
 * 不经过 AI 的通道，不在本模块职责内。
 */

// ── public API ──────────────────────────────────────────────────────────────

/**
 * @param {Object} source - { name, type, url, maxItems }
 * @returns {Promise<{items: Array<{title: string, url: string, excerpt: string, publishedAt: string}>}>}
 */
export async function fetchSource(source) {
  if (source.type !== 'rss') {
    console.warn(`[fetcher] ${source.name} 不支持的信源类型: ${source.type}`);
    return { items: [] };
  }
  try {
    const response = await fetch(source.url, {
      headers: { 'User-Agent': 'myDashboard/2.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.warn(`[fetcher] ${source.name} HTTP ${response.status}`);
      return { items: [] };
    }
    const text = await response.text();
    return { items: parseRSS(text, source.maxItems ?? 10) };
  } catch (err) {
    console.warn(`[fetcher] ${source.name} 抓取失败: ${err.message}`);
    return { items: [] };
  }
}

/**
 * 并行抓取所有信源。
 * @param {Array<Object>} sources
 * @returns {Promise<Array<{source: Object, items: Array}>>}
 */
export async function fetchAllSources(sources) {
  const results = await Promise.all(
    sources.map(async (source) => {
      const { items } = await fetchSource(source);
      return { source, items };
    }),
  );
  const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
  console.log(`[fetcher] ${sources.length} 个信源共抓取 ${totalItems} 条`);
  return results;
}

/**
 * 将抓取结果格式化为 prompt 注入文本块。
 * @param {Array<{source: Object, items: Array}>} results
 * @returns {string}
 */
export function formatSourcesForPrompt(results) {
  if (!results || results.length === 0) return '（无信源内容）';

  const parts = [];
  for (const { source, items } of results) {
    if (items.length === 0) continue;
    parts.push(`### ${source.name}`);
    for (const item of items) {
      parts.push(`- [${item.title}](${item.url})`);
      if (item.excerpt) parts.push(`  > ${item.excerpt.slice(0, 250)}`);
    }
    parts.push('');
  }
  return parts.join('\n') || '（无信源内容）';
}

// ── RSS parser ──────────────────────────────────────────────────────────────

/**
 * 正则解析 RSS XML，避免引入 xml2js 等额外依赖。
 * 支持标准 RSS 2.0 和 Atom feed 格式。
 */
function parseRSS(xml, maxItems = 10) {
  const items = [];

  // Try RSS 2.0 <item> blocks first
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    if (items.length >= maxItems) break;
    const parsed = parseRSSItem(match[1]);
    if (parsed) items.push(parsed);
  }

  // Fallback: try Atom <entry> blocks
  if (items.length === 0) {
    for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)) {
      if (items.length >= maxItems) break;
      const parsed = parseAtomEntry(match[1]);
      if (parsed) items.push(parsed);
    }
  }

  return items;
}

function parseRSSItem(itemXml) {
  const title = extractTag(itemXml, 'title');
  const link = extractTag(itemXml, 'link');
  if (!title) return null;

  return {
    title: cleanText(title),
    url: link || '',
    excerpt: cleanText(extractTag(itemXml, 'description') || '').slice(0, 300),
    publishedAt: extractTag(itemXml, 'pubDate') || '',
  };
}

function parseAtomEntry(entryXml) {
  const title = extractTag(entryXml, 'title');
  if (!title) return null;

  // Atom <link href="..."/>
  let link = '';
  const linkMatch = entryXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (linkMatch) link = linkMatch[1];

  const summary = extractTag(entryXml, 'summary') || extractTag(entryXml, 'content');
  const published = extractTag(entryXml, 'published') || extractTag(entryXml, 'updated');

  return {
    title: cleanText(title),
    url: link,
    excerpt: cleanText(summary || '').slice(0, 300),
    publishedAt: published || '',
  };
}

/** Extract inner text of an XML tag (handles CDATA and attributes). */
function extractTag(xml, tagName) {
  const pattern = new RegExp(
    `<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    'i',
  );
  const match = xml.match(pattern);
  if (!match) return '';
  // Strip CDATA wrapper if present
  return match[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1').trim();
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** Strip HTML tags and normalize whitespace. */
function stripHTML(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(text) {
  return stripHTML(text);
}
