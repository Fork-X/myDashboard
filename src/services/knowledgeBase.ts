/**
 * 知识库查询服务
 * 
 * 功能说明：
 * - 集成 Idealab Workflow (RF的AI-知识库1.0)
 * - 提供流式问答接口
 * - 支持实时内容更新
 * 
 * 应用标识：个人看板系统 - 知识库模块
 * Ideas Code: EGhnPxLcyge
 */

interface IdealabResponse {
  data: {
    content: string;
    messageId: string;
    sessionId: string;
    stream: boolean;
    streamEnd: boolean;
    success: boolean;
  };
}

interface KnowledgeQueryOptions {
  question: string;
  variableMap?: Record<string, string>;
  onUpdate?: (content: string) => void;
  onComplete?: (content: string) => void;
  onError?: (error: Error) => void;
}

async function runIdeasStream(
  experimentCode: string,
  version: string,
  question: string,
  variableMap: Record<string, string> = {}
): Promise<Response> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${baseUrl}/api/idealabworkflow/ideaPage/runIdeas/${experimentCode}/${version}`;

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'source': 'oneday',
    },
    body: JSON.stringify({
      question,
      stream: true,
      returnRunLog: false,
      variableMap,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response;
}

export async function queryKnowledgeBase(options: KnowledgeQueryOptions): Promise<string> {
  const { question, variableMap = {}, onUpdate, onComplete, onError } = options;

  try {
    const response = await runIdeasStream(
      'EGhnPxLcyge',
      'latest',
      question,
      {
        'system.question': question,
        ...variableMap,
      }
    );

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              const parsed: IdealabResponse = JSON.parse(jsonStr);

              if (parsed.data && parsed.data.success) {
                fullContent = parsed.data.content;

                if (onUpdate) {
                  onUpdate(fullContent);
                }

                if (parsed.data.streamEnd) {
                  if (onComplete) {
                    onComplete(fullContent);
                  }
                  return fullContent;
                }
              }
            } catch (e) {
              console.error('解析 JSON 失败:', e);
            }
          }
        }
      }
    }

    return fullContent;
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    if (onError) {
      onError(err);
    }
    throw err;
  }
}

export async function queryKnowledgeBaseSimple(question: string): Promise<string> {
  return queryKnowledgeBase({ question });
}
