/**
 * pipeline — 通用扫描管道
 *
 * 从 asset/ 目录发现板块配置，为每个题材按所属板块加载信源、渲染 prompt、
 * 调用 AI 扫描，将结果写入 inbox_items。
 *
 * 继承模型：`asset/_default/` 是缺省仓库（不出现在板块列表），板块目录只写
 * 差异项：domain.json 字段覆盖缺省值；sources.yaml 与缺省信源合并（按 URL 去重）；
 * prompt.md / skill.md 缺失时回落到 _default 的同名文件。存量数据里的遗留板块
 * 键 'stock' 解析到 _default，保证旧题材仍可扫描。
 */

import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchAllSources, formatSourcesForPrompt } from './fetcher.mjs';
import { renderPrompt, loadSystemPrompt, dumpPrompt } from './prompt.mjs';
import { listDirections, markDirectionScanned, createInboxItem } from './db/investment.mjs';

// ── 板块发现与配置继承（纯函数，供 pipeline 与 scan-dry 共用）─────────────

/**
 * 扫描 asset/ 目录。
 * @returns {Promise<{domains: Object[], defaultDomain: Object|null}>}
 *   domains       真实板块（已合并 _default 缺省值，排除 enabled:false）
 *   defaultDomain _default 本身（key 默认 'stock'，作为存量数据的兼容别名）
 */
export async function discoverDomains(assetDir) {
  let entries;
  try {
    entries = await readdir(assetDir, { withFileTypes: true });
  } catch {
    console.warn(`[pipeline] asset/ 目录不存在: ${assetDir}`);
    return { domains: [], defaultDomain: null };
  }

  // 先读 _default，它的字段是所有板块的缺省值
  let defaultDomain = null;
  const defaultDir = resolve(assetDir, '_default');
  try {
    const raw = await readFile(resolve(defaultDir, 'domain.json'), 'utf-8');
    const config = JSON.parse(raw);
    defaultDomain = { ...config, dir: defaultDir, key: config.key || 'stock' };
  } catch { /* 没有 _default 时板块各自完整配置 */ }

  const domains = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const dir = resolve(assetDir, entry.name);
    try {
      const raw = await readFile(resolve(dir, 'domain.json'), 'utf-8');
      const config = JSON.parse(raw);
      const merged = { ...(defaultDomain ?? {}), ...config, dir, key: config.key || entry.name };
      if (merged.enabled === false) continue;
      domains.push(merged);
    } catch (err) {
      console.warn(`[pipeline] 跳过板块 ${entry.name}: ${err.message}`);
    }
  }

  domains.sort((a, b) => a.key.localeCompare(b.key));
  return { domains, defaultDomain };
}

/** 读一个目录的 sources.yaml，失败或缺失返回 []。 */
async function readSourcesFile(dir) {
  try {
    const yaml = await readFile(resolve(dir, 'sources.yaml'), 'utf-8');
    return parseSourceYAML(yaml);
  } catch {
    return [];
  }
}

/**
 * 板块的最终信源 = _default 通用信源 + 板块专属信源（按 URL 去重）。
 */
export async function resolveDomainSources(domain, defaultDomain) {
  const merged = [];
  const seen = new Set();
  const lists = [];
  if (defaultDomain && defaultDomain.dir !== domain.dir) {
    lists.push(await readSourcesFile(defaultDomain.dir));
  }
  lists.push(await readSourcesFile(domain.dir));
  for (const list of lists) {
    for (const source of list) {
      if (!source.url || seen.has(source.url)) continue;
      seen.add(source.url);
      merged.push(source);
    }
  }
  return merged;
}

/** 读板块的 prompt.md，缺失时回落 _default。 */
export async function resolvePromptTemplate(domain, defaultDomain) {
  try {
    return await readFile(resolve(domain.dir, 'prompt.md'), 'utf-8');
  } catch (err) {
    if (defaultDomain && defaultDomain.dir !== domain.dir) {
      return await readFile(resolve(defaultDomain.dir, 'prompt.md'), 'utf-8');
    }
    throw err;
  }
}

/** 读板块的 skill.md 作为 systemPrompt，缺失时回落 _default，都没有返回 ''。 */
export async function resolveSystemPrompt(domain, defaultDomain) {
  try {
    return await loadSystemPrompt(domain.dir);
  } catch {
    if (defaultDomain && defaultDomain.dir !== domain.dir) {
      try {
        return await loadSystemPrompt(defaultDomain.dir);
      } catch { /* fall through */ }
    }
    return '';
  }
}

// ── public factory ──────────────────────────────────────────────────────────

/**
 * @param {Object}   opts
 * @param {Object}   opts.db          SQLite database handle
 * @param {Function} opts.queryFn     SDK query function (prompt, options) => AsyncGenerator
 * @param {string}   opts.assetDir    Absolute path to asset/ directory
 * @param {string}   [opts.dumpDir]   目录：每次扫描把最终 prompt 写到这里供人工核对
 */
export function createPipeline({ db, queryFn, assetDir, dumpDir }) {
  /** Ids of directions currently being scanned. */
  const scanning = new Set();

  /** In-memory cache: {domains, defaultDomain}，首次访问时扫目录，改配置需重启。 */
  let assetCache = null;

  // ── domain discovery ──────────────────────────────────────────────────

  async function loadAssets() {
    if (assetCache) return assetCache;
    assetCache = await discoverDomains(assetDir);
    if (assetCache.domains.length > 0) {
      console.log(`[pipeline] 发现 ${assetCache.domains.length} 个板块: ${assetCache.domains.map((d) => d.key).join(', ')}`
        + (assetCache.defaultDomain ? '（_default 提供缺省配置）' : ''));
    }
    return assetCache;
  }

  /**
   * 按键解析板块：真实板块优先；存量数据的遗留键（_default 的 key，即 'stock'）
   * 解析到 _default 本身，保证旧题材仍可扫描。
   */
  async function loadDomainConfig(domainKey) {
    const { domains, defaultDomain } = await loadAssets();
    const sector = domains.find((d) => d.key === domainKey);
    if (sector) return sector;
    if (defaultDomain && defaultDomain.key === domainKey) return defaultDomain;
    return null;
  }

  // ── source loading & merging ──────────────────────────────────────────

  async function loadSources(domain) {
    const { defaultDomain } = await loadAssets();
    return resolveDomainSources(domain, defaultDomain);
  }

  // ── scan orchestration ────────────────────────────────────────────────

  async function scanDirection(directionId) {
    if (scanning.has(directionId)) {
      throw Object.assign(new Error('该题材正在扫描中，请稍后再试'), { status: 409 });
    }
    scanning.add(directionId);

    try {
      const directions = listDirections(db);
      const dir = directions.find((d) => d.id === directionId);
      if (!dir || !dir.enabled) {
        throw Object.assign(new Error('题材不存在或已停用'), { status: 400 });
      }

      const domainKey = dir.domain || 'stock';
      const domain = await loadDomainConfig(domainKey);
      if (!domain) {
        throw Object.assign(new Error(`板块 "${domainKey}" 未配置，请检查 asset/ 目录`), { status: 400 });
      }

      // 1. Load & fetch sources
      const sources = await loadSources(domain);
      let sourceText = '';
      if (sources.length > 0) {
        const fetched = await fetchAllSources(sources);
        sourceText = formatSourcesForPrompt(fetched);
      }

      // 2. Render prompt —— skill.md 作为 systemPrompt，prompt.md 作为本次任务
      //    板块没有自己的 prompt.md / skill.md 时自动回落 _default
      const { defaultDomain } = await loadAssets();
      const template = await resolvePromptTemplate(domain, defaultDomain);
      const userPrompt = renderPrompt(template, {
        domainName: domain.name,
        directionName: dir.name,
        description: dir.description || '',
        keywords: dir.keywords || '',
        sources: sourceText || '（无信源内容）',
        today: new Date().toISOString().slice(0, 10),
        ambushDays: String(domain.ambushDays ?? 60),
      }, `${domain.key}/prompt.md`);

      const systemPrompt = await resolveSystemPrompt(domain, defaultDomain);

      if (dumpDir) {
        const path = await dumpPrompt({ dir: dumpDir, directionId: dir.id, systemPrompt, userPrompt });
        if (path) console.log(`[pipeline] 本次 prompt 已写入 ${path}`);
      }

      // 3. Call AI
      const text = await callAI(queryFn, { systemPrompt, userPrompt }, dir.name, domain);

      // 4. Parse & ingest
      const items = parseScanResult(text, dir.id, domain.key);
      const saved = [];
      for (const item of items) {
        try {
          saved.push(createInboxItem(db, item));
        } catch (err) {
          console.error(`[pipeline] 丢弃不合格结果: ${err.message}`);
        }
      }

      markDirectionScanned(db, dir.id);

      if (saved.length === 0) {
        console.log(`[pipeline] 题材「${dir.name}」扫描完成，未发现新事件`);
      } else {
        console.log(`[pipeline] 题材「${dir.name}」扫描完成，投递 ${saved.length} 条到收件箱`);
      }
      return { direction: dir.name, domain: domain.key, count: saved.length, items: saved };
    } finally {
      scanning.delete(directionId);
    }
  }

  // ── polling ───────────────────────────────────────────────────────────

  function startPolling() {
    const CHECK_INTERVAL_MS = 5 * 60 * 1000;

    const backgroundScan = (dir, delayMs = 0) => {
      setTimeout(() => {
        if (scanning.has(dir.id)) return;
        scanDirection(dir.id).catch((err) => {
          console.error(`[pipeline] 题材「${dir.name}」后台扫描失败:`, err.message);
        });
      }, delayMs);
    };

    const timer = setInterval(() => {
      try {
        const directions = listDirections(db).filter((d) => d.enabled);
        for (const dir of directions) {
          if (scanning.has(dir.id)) continue;
          if (!dir.lastScannedAt) {
            backgroundScan(dir, Math.floor(Math.random() * 30_000));
          } else {
            const elapsed = Date.now() - new Date(dir.lastScannedAt).getTime();
            const intervalMs = (dir.scanIntervalHours || 6) * 60 * 60 * 1000;
            if (elapsed >= intervalMs) {
              backgroundScan(dir);
            }
          }
        }
      } catch { /* polling errors shouldn't crash the timer */ }
    }, CHECK_INTERVAL_MS);

    timer.unref();
    console.log(`[pipeline] 轮询已启动（每 ${CHECK_INTERVAL_MS / 1000}s 检查一次）`);
    return () => clearInterval(timer);
  }

  // ── domain listing (for API) ──────────────────────────────────────────

  async function listDomains() {
    const { domains } = await loadAssets();
    return domains.map((d) => ({
      key: d.key,
      name: d.name,
      ambushDays: d.ambushDays ?? 60,
    }));
  }

  return { scanDirection, startPolling, listDomains };
}

// ── AI calling ──────────────────────────────────────────────────────────────

/**
 * 调用模型。
 *
 * skill.md 走 systemPrompt 而不是 SDK 的 Skill 工具：省一轮工具调用，且不依赖
 * .qoder/skills 目录，asset/ 因此保持为与 SDK 无关的纯数据。
 *
 * 必须有总超时：实测 WebSearch 在内网会挂死连接（既不报错也不返回），
 * 没有超时时一次扫描会无限期占用并发锁，后续轮询全部被阻塞。
 */
async function callAI(queryFn, { systemPrompt, userPrompt }, topicName, domain) {
  const timeoutMinutes = domain.timeoutMinutes ?? 10;
  const abortController = new AbortController();
  const timeoutTimer = setTimeout(
    () => abortController.abort(),
    timeoutMinutes * 60 * 1000,
  );

  // CLI 子进程的 stderr 是它非零退出时唯一的原因来源，不接就只能看到
  // “exited with code 1” 这种毫无信息量的报错。
  const stderrLines = [];
  const q = queryFn({
    prompt: userPrompt,
    options: {
      maxTurns: domain.maxTurns ?? 1,
      allowedTools: domain.allowedTools ?? ['WebSearch'],
      abortController,
      stderr: (data) => {
        const line = String(data).trim();
        if (line) stderrLines.push(line);
      },
      ...(systemPrompt
        ? { systemPrompt: { type: 'preset', preset: 'qodercli', append: systemPrompt } }
        : {}),
    },
  });

  let text = '';
  const toolCalls = [];
  try {
    for await (const msg of q) {
      if (msg.type === 'assistant') {
        const blocks = msg.message?.content ?? [];
        text += blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
        for (const b of blocks) {
          if (b.type === 'tool_use') {
            toolCalls.push(b.name);
            // 即时打印：工具调用挂住时，这是日志里能看到的最后一条线索
            console.log(`[pipeline] 「${topicName}」调用工具 ${b.name}: ${JSON.stringify(b.input ?? {}).slice(0, 200)}`);
          }
        }
      }
      if (msg.type === 'system' && msg.subtype === 'model_queue_status' && msg.status === 'queued') {
        console.log(`[pipeline] 「${topicName}」排队中：队列 ${msg.queue_count}，已等待 ${Math.round((msg.queue_wait_elapsed_ms ?? 0) / 1000)}s`);
      }
      if (msg.type === 'result') {
        console.log(`[pipeline] 「${topicName}」模型返回：${msg.subtype} ${msg.duration_ms}ms turns=${msg.num_turns} credits=${msg.total_credits ?? 'n/a'} 工具=[${toolCalls.join(', ')}]`);
      }
    }
  } catch (error) {
    if (abortController.signal.aborted) {
      throw Object.assign(
        new Error(`AI 扫描超时（${timeoutMinutes} 分钟），已终止。最后的工具调用: [${toolCalls.join(', ') || '无'}]`),
        { status: 504 },
      );
    }
    const reason = error instanceof Error ? error.message : '未知错误';
    const detail = stderrLines.length > 0
      ? `；CLI stderr: ${stderrLines.slice(-5).join(' | ')}`
      : '；CLI 未输出 stderr';
    throw Object.assign(
      new Error(`AI 扫描失败: ${reason}${detail}`),
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutTimer);
    await q.close?.().catch(() => {});
  }

  if (!text) {
    console.warn(`[pipeline] 题材「${topicName}」AI 未返回文本内容`);
  }
  return text;
}

// ── JSON extraction (same logic as scanner.mjs) ─────────────────────────────

function parseScanResult(text, directionId, domain) {
  if (!text) return [];

  let jsonStr = extractFromCodeBlock(text);
  if (!jsonStr) {
    jsonStr = extractWithBracketBalance(text);
  }

  if (!jsonStr) {
    console.error(
      `[pipeline] JSON 提取失败，AI 原始响应前 500 字符:\n${text.slice(0, 500)}`,
    );
    return [];
  }

  let items;
  try {
    items = JSON.parse(jsonStr);
  } catch (err) {
    console.error(
      `[pipeline] JSON 解析失败: ${err.message}\n提取到的内容前 500 字符:\n${jsonStr.slice(0, 500)}`,
    );
    return [];
  }

  if (!Array.isArray(items)) {
    console.error(`[pipeline] AI 返回的不是数组，类型: ${typeof items}`);
    return [];
  }

  return items.map((item) => ({
    directionId,
    domain,
    sourceSummary: item.sourceSummary || '',
    sourceUrl: item.sourceUrl || '',
    aiEventName: item.aiEventName || '',
    aiEventStartDate: item.aiEventStartDate || '',
    aiEventEndDate: item.aiEventEndDate || '',
    dateConfidence: item.dateConfidence === 'exact' ? 'exact' : 'fuzzy',
    aiTags: Array.isArray(item.aiTags) ? item.aiTags : [],
    aiTickers: Array.isArray(item.aiTickers) ? item.aiTickers : [],
  }));
}

function extractFromCodeBlock(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!match) return null;
  const inner = match[1].trim();
  if (inner.startsWith('[') && inner.endsWith(']')) return inner;
  return null;
}

function extractWithBracketBalance(text) {
  const start = text.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// ── simple YAML parser (only handles the sources list format we use) ────────

function parseSourceYAML(yaml) {
  const sources = [];
  let current = null;

  for (const line of yaml.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === 'sources:' || trimmed === '' || trimmed.startsWith('#')) continue;

    const nameMatch = trimmed.match(/^- name:\s*["']?(.+?)["']?\s*$/);
    if (nameMatch) {
      if (current) sources.push(current);
      current = { name: nameMatch[1], type: 'rss', url: '', maxItems: 10 };
      continue;
    }

    if (current) {
      const typeMatch = trimmed.match(/^type:\s*(\w+)/);
      if (typeMatch) { current.type = typeMatch[1]; continue; }

      const urlMatch = trimmed.match(/^url:\s*["']?(.+?)["']?\s*$/);
      if (urlMatch) { current.url = urlMatch[1]; continue; }

      const maxItemsMatch = trimmed.match(/^maxItems:\s*(\d+)/);
      if (maxItemsMatch) { current.maxItems = parseInt(maxItemsMatch[1], 10); continue; }
    }
  }

  if (current) sources.push(current);
  return sources;
}
