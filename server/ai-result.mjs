/**
 * AI 调用失败的统一解读入口。
 *
 * qoder-agent-sdk 的失败不抛异常：它照常发一条 `result` 消息，把原因塞在
 * `is_error` / `errors` / `terminal_reason` 里。调用方只 for-await 收集
 * assistant 文本的话，失败会退化成「什么都没返回」——这是本项目踩过的坑：
 * 登录过期时对话静默无响应、题材扫描却记录为「扫描完成，未发现新事件」。
 *
 * 所有 queryFn 的消费者（chat / 题材扫描 / 对话提炼）都应经由此处解读失败，
 * 保证同一个底层故障在任何入口都给出同一句人话。
 */

const AUTH_EXPIRED_HINT = '本地登录已过期，请在终端执行 qodercli login 后重启服务';

/** 失败的 result 消息 → 一句用户能照着做的话。 */
export function describeResultError(result) {
  const details = (result.errors ?? [])
    .filter((item) => typeof item === 'string' && item.trim())
    .join('；');
  if (result.terminal_reason === 'auth_expired') {
    return details ? `${AUTH_EXPIRED_HINT}（${details}）` : AUTH_EXPIRED_HINT;
  }
  return details || `AI 调用失败（${result.terminal_reason ?? result.subtype ?? '未知原因'}）`;
}

/** 这条 SDK 消息是否是一次失败的 result。 */
export function isFailedResult(msg) {
  return msg?.type === 'result' && Boolean(msg.is_error);
}
