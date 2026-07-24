import { useState, useEffect } from 'react';
import { supabase } from '../../onedaycloud/client';
import { Tables } from '../../onedaycloud/types';
import Card from '../common/Card';
import Loading from '../common/Loading';
import EmptyState from '../common/EmptyState';
import { BookOpen, Tag } from 'lucide-react';

type Knowledge = Tables<'investment_knowledge'>;

const mockKnowledge: Knowledge[] = [
  {
    id: 'mock-1',
    title: '价值投资的核心理念',
    content: '价值投资的本质是以低于内在价值的价格买入优质资产，并长期持有。关键在于理解企业的商业模式、竞争优势和成长潜力，而不是追逐短期市场波动。',
    category: '投资理念',
    tags: ['价值投资', '长期持有', '基本面分析'],
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-10T10:00:00Z'
  },
  {
    id: 'mock-2',
    title: '分散投资与资产配置',
    content: '不要把所有鸡蛋放在一个篮子里。合理的资产配置应该包括股票、债券、现金等不同类别，根据风险承受能力和投资目标进行动态调整。',
    category: '风险管理',
    tags: ['资产配置', '分散投资', '风险控制'],
    created_at: '2024-01-15T14:30:00Z',
    updated_at: '2024-01-15T14:30:00Z'
  },
  {
    id: 'mock-3',
    title: '市场情绪与逆向思维',
    content: '在别人贪婪时恐惧，在别人恐惧时贪婪。市场情绪往往会导致资产价格偏离其真实价值，这为理性投资者创造了机会。',
    category: '投资心理',
    tags: ['市场情绪', '逆向投资', '巴菲特'],
    created_at: '2024-02-01T09:00:00Z',
    updated_at: '2024-02-01T09:00:00Z'
  },
  {
    id: 'mock-4',
    title: '复利的力量',
    content: '复利是世界第八大奇迹。年化10%的收益率，30年后本金将增长17倍。时间是复利最好的朋友，越早开始投资，复利效应越显著。',
    category: '投资数学',
    tags: ['复利', '长期投资', '时间价值'],
    created_at: '2024-02-10T16:20:00Z',
    updated_at: '2024-02-10T16:20:00Z'
  },
  {
    id: 'mock-5',
    title: '估值方法：PE、PB、DCF',
    content: 'PE（市盈率）适用于盈利稳定的企业，PB（市净率）适用于资产密集型企业，DCF（现金流折现）是最严谨的估值方法。不同行业应选择合适的估值指标。',
    category: '估值分析',
    tags: ['估值', 'PE', 'PB', 'DCF'],
    created_at: '2024-02-20T11:45:00Z',
    updated_at: '2024-02-20T11:45:00Z'
  },
  {
    id: 'mock-6',
    title: '行业周期与投资时机',
    content: '不同行业有不同的周期特征。周期性行业在经济复苏期表现较好，防御性行业在经济衰退期更稳健。理解行业周期有助于把握投资时机。',
    category: '行业分析',
    tags: ['行业周期', '经济周期', '投资时机'],
    created_at: '2024-03-05T13:10:00Z',
    updated_at: '2024-03-05T13:10:00Z'
  }
];

export default function KnowledgeList() {
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const fetchKnowledge = async () => {
    try {
      const { data, error } = await supabase
        .from('investment_knowledge')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const dbData = data || [];
      setKnowledge(dbData.length > 0 ? dbData : mockKnowledge);
    } catch (error) {
      console.error('Error fetching knowledge:', error);
      setKnowledge(mockKnowledge);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  if (knowledge.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen size={64} />}
        title="暂无投资知识"
        description="开始添加您的投资知识和经验"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {knowledge.map((item, index) => (
        <Card key={item.id} number={String(index + 1).padStart(4, '0')}>
          <h3 className="text-lg font-bold text-vintage-dark mb-2">{item.title}</h3>
          <div className="vintage-divider"></div>
          <p className="text-vintage-brown text-sm mb-4 line-clamp-3">{item.content}</p>
          {item.category && (
            <div className="vintage-stamp mb-3">
              {item.category}
            </div>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-dashed border-vintage-border">
              <Tag size={14} className="text-vintage-brown" />
              {item.tags.map((tag, idx) => (
                <span key={idx} className="text-xs text-vintage-brown border border-vintage-border px-2 py-1 rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
