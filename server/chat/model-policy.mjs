export function resolveModelPolicy() {
  const spec = process.env.CHAT_MODEL ?? 'dmodel';
  if (spec === 'byok:deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('BYOK 模式需要 DEEPSEEK_API_KEY 环境变量');
    return {
      resolveModel: () => ({
        model: {
          provider: 'deepseek',
          model: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-pro',
          api_key: apiKey,
        },
      }),
    };
  }
  return { model: spec };
}
