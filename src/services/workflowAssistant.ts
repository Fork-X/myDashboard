/**
 * 保证金造数助手服务
 * 
 * 功能说明：
 * - 集成 Idealab Workflow (RF的AI-知识库1.0)
 * - 用于保证金造数执行的问答
 * - 提供流式问答接口
 * - 支持实时内容更新
 * 
 * 应用标识：个人看板系统 - 保证金造数助手
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

interface WorkflowQueryOptions {
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
  const isOneDayEnv = typeof window !== 'undefined' && window.location.hostname.includes('alibaba-inc.com');

  let url: string;
  let headers: Record<string, string>;

  if (isOneDayEnv) {
    const baseUrl = window.location.origin;
    url = `${baseUrl}/api/idealabworkflow/ideaPage/runIdeas/${experimentCode}/${version}`;
    headers = {
      'Content-Type': 'application/json',
      'source': 'oneday',
    };
  } else {
    url = `https://idealab.alibaba-inc.com/api/ideaPage/runIdeas/${experimentCode}/${version}`;
    headers = {
      'Content-Type': 'application/json',
    };
  }

  console.log('调用 Workflow API:', url);
  console.log('请求参数:', { question, variableMap });

  const response = await fetch(url, {
    method: 'POST',
    credentials: isOneDayEnv ? 'include' : 'omit',
    headers,
    body: JSON.stringify({
      question,
      stream: true,
      returnRunLog: false,
      variableMap,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API 错误响应:', errorText);
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
  }

  return response;
}

export async function queryWorkflow(options: WorkflowQueryOptions): Promise<string> {
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
              console.error('解析 JSON 失败:', e, '原始数据:', line);
            }
          }
        }
      }
    }

    return fullContent;
  } catch (error) {
    console.error('Workflow 查询错误:', error);
    const err = error instanceof Error ? error : new Error('Unknown error');
    if (onError) {
      onError(err);
    }
    throw err;
  }
}

export async function queryWorkflowSimple(question: string): Promise<string> {
  return queryWorkflow({ question });
}
