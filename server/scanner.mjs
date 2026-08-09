import { createInboxItem, listDirections, markDirectionScanned } from './db/investment.mjs';

export function createScanner({ db, queryFn }) {
  async function scanDirection(directionId) {
    const directions = listDirections(db);
    const dir = directions.find((d) => d.id === directionId);
    if (!dir || !dir.enabled) {
      throw Object.assign(new Error('题材不存在或已停用'), { status: 400 });
    }

    const prompt = buildScanPrompt(dir);
    const text = await callAI(queryFn, prompt, dir.name);
    const items = parseScanResult(text, dir.id);
    const saved = [];
    for (const item of items) {
      saved.push(createInboxItem(db, item));
    }
    markDirectionScanned(db, dir.id);

    if (saved.length === 0) {
      console.log(`[scanner] 题材「${dir.name}」扫描完成，未发现新事件`);
    } else {
      console.log(`[scanner] 题材「${dir.name}」扫描完成，投递 ${saved.length} 条到收件箱`);
    }
    return { direction: dir.name, count: saved.length, items: saved };
  }

  function buildScanPrompt(dir) {
    const parts = [
      `你是一个投资事件扫描助手。请根据以下题材扫描近期可能影响股票市场的投资事件。`,
      ``,
      `## 扫描题材`,
      `- 名称：${dir.name}`,
    ];
    if (dir.description) parts.push(`- 描述：${dir.description}`);
    if (dir.keywords) parts.push(`- 关键词：${dir.keywords}`);

    parts.push(
      ``,
      `## 要求`,
      `请使用 WebSearch 工具搜索近期（未来1-3个月）可能发生的事件。`,
      `为每个找到的事件生成以下 JSON：`,
      `{`,
      `  "sourceSummary": "原始新闻摘要",`,
      `  "sourceUrl": "来源链接（如有）",`,
      `  "aiEventName": "简短事件名称",`,
      `  "aiEventStartDate": "YYYY-MM-DD 格式的开始日期，模糊日期取中间值",`,
      `  "aiEventEndDate": "YYYY-MM-DD 格式的结束日期",`,
      `  "dateConfidence": "exact 或 fuzzy",`,
      `  "aiTags": ["标签1", "标签2"],`,
      `  "aiTickers": [{"symbol": "代码", "name": "名称"}]`,
      `}`,
      ``,
      `请返回一个 JSON 数组。如果没有找到相关事件，返回空数组 []。`,
      `只返回 JSON 数组，不要包含其他文字。`,
      `当前日期：${new Date().toISOString().slice(0, 10)}`,
    );

    return parts.join('\n');
  }

  function startPolling() {
    const CHECK_INTERVAL_MS = 5 * 60 * 1000;

    const timer = setInterval(() => {
      try {
        const directions = listDirections(db).filter((d) => d.enabled);
        for (const dir of directions) {
          if (!dir.lastScannedAt) {
            // Never scanned — stagger first scan by random delay to avoid thundering herd
            const delay = Math.floor(Math.random() * 30_000);
            setTimeout(() => {
              scanDirection(dir.id).catch((err) => {
                console.error(`[scanner] 题材「${dir.name}」后台扫描失败:`, err.message);
              });
            }, delay);
          } else {
            const elapsed = Date.now() - new Date(dir.lastScannedAt).getTime();
            const intervalMs = dir.scanIntervalHours * 60 * 60 * 1000;
            if (elapsed >= intervalMs) {
              scanDirection(dir.id).catch((err) => {
                console.error(`[scanner] 题材「${dir.name}」后台扫描失败:`, err.message);
              });
            }
          }
        }
      } catch { /* polling errors shouldn't crash */ }
    }, CHECK_INTERVAL_MS);

    timer.unref();
    return () => clearInterval(timer);
  }

  return { scanDirection, startPolling };
}

/**
 * Call the AI via qoder-agent-sdk and collect assistant text blocks.
 * queryFn returns an AsyncGenerator — must iterate, not just await.
 */
async function callAI(queryFn, prompt, topicName) {
  const q = queryFn({ prompt, options: { maxTurns: 1 } });
  let text = '';
  try {
    for await (const msg of q) {
      if (msg.type === 'assistant') {
        const blocks = msg.message?.content ?? [];
        text += blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
      }
    }
  } catch (error) {
    throw Object.assign(
      new Error(`AI 扫描失败: ${error instanceof Error ? error.message : '未知错误'}`),
      { status: 502 },
    );
  } finally {
    await q.close?.().catch(() => {});
  }

  if (!text) {
    console.warn(`[scanner] 题材「${topicName}」AI 未返回文本内容`);
  }
  return text;
}

/**
 * Extract JSON array from AI response text.
 * Uses staged extraction: code block first, then regex fallback.
 */
function parseScanResult(text, directionId) {
  if (!text) return [];

  let jsonStr = extractFromCodeBlock(text);
  if (!jsonStr) {
    jsonStr = extractWithRegex(text);
  }

  if (!jsonStr) {
    console.error(
      `[scanner] JSON 提取失败，AI 原始响应前 500 字符:\n${text.slice(0, 500)}`,
    );
    return [];
  }

  let items;
  try {
    items = JSON.parse(jsonStr);
  } catch (err) {
    console.error(
      `[scanner] JSON 解析失败: ${err.message}\n提取到的内容前 500 字符:\n${jsonStr.slice(0, 500)}`,
    );
    return [];
  }

  if (!Array.isArray(items)) {
    console.error(`[scanner] AI 返回的不是数组，类型: ${typeof items}`);
    return [];
  }

  return items.map((item) => ({
    directionId,
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

/** Try to extract JSON from a markdown code block (```json ... ```). */
function extractFromCodeBlock(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!match) return null;
  const inner = match[1].trim();
  // Verify it looks like a JSON array
  if (inner.startsWith('[') && inner.endsWith(']')) {
    return inner;
  }
  return null;
}

/** Fallback: find the outermost JSON array with non-greedy match. */
function extractWithRegex(text) {
  // Use a character-by-character bracket-balancing approach for robustness
  const start = text.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}