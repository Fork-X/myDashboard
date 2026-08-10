/**
 * AI 模型选择：所有 AI 调用（chat / 题材扫描 / 对话提炼）的唯一模型入口，
 * 由 server/index.mjs 注入到 queryFn 的 SDK options 中。
 *
 * 模型 key 由 Qoder 平台定义，无需 API Key，走订阅额度。常用值：
 *   kmodel_latest = Kimi-K3      dmodel       = DeepSeek-V4-Pro
 *   kmodel        = Kimi-K2.7    qmodel_38max = Qwen3.8-Max
 *   gm51model     = GLM-5.2      auto         = 平台自动选择
 *
 * 完整实时列表：node scripts/list-models.mjs
 * 此处不做本地校验 —— 有效模型由平台裁定，重复一份清单只会漂移。
 */
export const AI_MODEL = process.env.AI_MODEL ?? 'kmodel_latest';

export function resolveModelPolicy() {
  return { model: AI_MODEL };
}
