/**
 * 列出当前 Qoder 账号可用的模型 —— 用于给 .env 的 AI_MODEL 选值。
 * 用法：node scripts/list-models.mjs
 */
import { qodercliAuth, query } from '@qoder-ai/qoder-agent-sdk';

const q = query({
  prompt: (async function* () { /* 只用控制请求，不发消息 */ })(),
  options: { auth: qodercliAuth() },
});

try {
  for (const m of await q.getAvailableModels() ?? []) {
    const price = m.priceFactor != null ? `${m.priceFactor}x` : '';
    console.log(`${m.value.padEnd(26)} ${(m.displayName ?? '').padEnd(22)} ${price}`);
  }
} finally {
  await q.close().catch(() => {});
}
