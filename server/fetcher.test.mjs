import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { createServer } from 'node:http';
import { fetchSource, fetchAllSources, formatSourcesForPrompt } from './fetcher.mjs';

// ── test helpers ────────────────────────────────────────────────────────────

/** Start a local HTTP server that returns the given response, return its URL. */
function serve(content, contentType = 'text/xml', status = 200) {
  return new Promise((resolve) => {
    const server = createServer((_, res) => {
      res.writeHead(status, { 'content-type': contentType });
      res.end(content);
    });
    server.listen(0, () => {
      const addr = server.address();
      resolve({ url: `http://127.0.0.1:${addr.port}`, server });
    });
  });
}

// ── RSS parsing ─────────────────────────────────────────────────────────────

describe('fetchSource with RSS', () => {
  let rssServer;

  before(async () => {
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>朱雀三号遥二将于8月11日发射</title>
      <link>https://example.com/zhuque-3</link>
      <description>中国商业航天公司宣布朱雀三号遥二运载火箭计划于2026年8月11日在酒泉发射。</description>
      <pubDate>Mon, 04 Aug 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Another Event</title>
      <link>https://example.com/another</link>
      <description>Some description with <b>HTML</b> tags.</description>
      <pubDate>Tue, 05 Aug 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;
    const { url, server } = await serve(rssXml);
    rssServer = { url, server };
  });

  after(() => {
    rssServer.server.close();
  });

  it('parses RSS items correctly', async () => {
    const result = await fetchSource({
      name: 'test-rss',
      type: 'rss',
      url: rssServer.url,
      maxItems: 10,
    });

    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].title, '朱雀三号遥二将于8月11日发射');
    assert.equal(result.items[0].url, 'https://example.com/zhuque-3');
    assert.ok(result.items[0].excerpt.includes('商业航天'));
    assert.ok(result.items[0].publishedAt);
  });

  it('respects maxItems', async () => {
    const result = await fetchSource({
      name: 'test-rss',
      type: 'rss',
      url: rssServer.url,
      maxItems: 1,
    });

    assert.equal(result.items.length, 1);
  });

  it('strips HTML from excerpts', async () => {
    const result = await fetchSource({
      name: 'test-rss',
      type: 'rss',
      url: rssServer.url,
      maxItems: 10,
    });

    const secondItem = result.items[1];
    assert.ok(!secondItem.excerpt.includes('<b>'));
    assert.ok(secondItem.excerpt.includes('HTML'));
  });
});

// ── Atom parsing ────────────────────────────────────────────────────────────

describe('fetchSource with Atom feed', () => {
  let atomServer;

  before(async () => {
    const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>AI Model Release</title>
    <link href="https://example.com/ai-model"/>
    <summary>A new large language model was released today.</summary>
    <published>2026-08-10T08:00:00Z</published>
  </entry>
</feed>`;
    const { url, server } = await serve(atomXml);
    atomServer = { url, server };
  });

  after(() => {
    atomServer.server.close();
  });

  it('parses Atom entries', async () => {
    const result = await fetchSource({
      name: 'test-atom',
      type: 'rss',
      url: atomServer.url,
      maxItems: 10,
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].title, 'AI Model Release');
    assert.equal(result.items[0].url, 'https://example.com/ai-model');
    assert.ok(result.items[0].publishedAt);
  });
});

// ── unsupported types ─────────────────────────────────────────────────────────

describe('fetchSource with unsupported type', () => {
  it('returns empty items without issuing a request', async () => {
    const result = await fetchSource({
      name: 'legacy-webpage-source',
      type: 'webpage',
      url: 'http://127.0.0.1:9999/should-not-be-called',
      maxItems: 10,
    });
    assert.deepEqual(result.items, []);
  });
});

// ── error handling ──────────────────────────────────────────────────────────

describe('fetchSource error handling', () => {
  it('returns empty items on HTTP error', async () => {
    const { url, server } = await serve('Not Found', 'text/plain', 404);
    try {
      const result = await fetchSource({
        name: 'error-source',
        type: 'rss',
        url,
        maxItems: 10,
      });
      assert.deepEqual(result.items, []);
    } finally {
      server.close();
    }
  });

  it('returns empty items on network failure', async () => {
    const result = await fetchSource({
      name: 'bad-url',
      type: 'rss',
      url: 'http://127.0.0.1:9999/nonexistent',
      maxItems: 10,
    });
    assert.deepEqual(result.items, []);
  });
});

// ── fetchAllSources ─────────────────────────────────────────────────────────

describe('fetchAllSources', () => {
  it('fetches multiple sources in parallel', async () => {
    const { url: url1, server: s1 } = await serve(
      '<rss><channel><item><title>A</title><link>http://a</link></item></channel></rss>',
    );
    const { url: url2, server: s2 } = await serve(
      '<rss><channel><item><title>B</title><link>http://b</link></item></channel></rss>',
    );

    try {
      const results = await fetchAllSources([
        { name: 's1', type: 'rss', url: url1, maxItems: 10 },
        { name: 's2', type: 'rss', url: url2, maxItems: 10 },
      ]);

      assert.equal(results.length, 2);
      assert.equal(results[0].items[0].title, 'A');
      assert.equal(results[1].items[0].title, 'B');
    } finally {
      s1.close();
      s2.close();
    }
  });
});

// ── formatSourcesForPrompt ──────────────────────────────────────────────────

describe('formatSourcesForPrompt', () => {
  it('formats fetched results for prompt injection', () => {
    const results = [
      {
        source: { name: '财联社' },
        items: [
          { title: 'News 1', url: 'https://a.com', excerpt: 'Exciting news about stocks.', publishedAt: '' },
        ],
      },
      {
        source: { name: '华尔街见闻' },
        items: [
          { title: 'News 2', url: 'https://b.com', excerpt: 'Market update.', publishedAt: '' },
          { title: 'News 3', url: 'https://c.com', excerpt: '', publishedAt: '' },
        ],
      },
      {
        source: { name: 'Empty Source' },
        items: [],
      },
    ];

    const formatted = formatSourcesForPrompt(results);

    assert.ok(formatted.includes('财联社'));
    assert.ok(formatted.includes('华尔街见闻'));
    assert.ok(formatted.includes('News 1'));
    assert.ok(formatted.includes('https://a.com'));
    assert.ok(!formatted.includes('Empty Source'), 'empty sources should be skipped');
  });

  it('returns fallback for empty results', () => {
    assert.equal(formatSourcesForPrompt([]), '（无信源内容）');
    assert.equal(formatSourcesForPrompt(null), '（无信源内容）');
  });
});
