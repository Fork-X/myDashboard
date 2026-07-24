import { useState, useEffect } from 'react';
import { supabase } from '../onedaycloud/client';
import { Tables } from '../onedaycloud/types';
import { format } from 'date-fns';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
import { Briefcase, MapPin, Calendar, DollarSign, Lock, Eye, EyeOff } from 'lucide-react';

type Career = Tables<'career_timeline'>;

const PASSWORD = 'career2024';

const mockCareers: Career[] = [
  {
    id: 'mock-1',
    company: '阿里巴巴集团',
    position: '高级前端工程师',
    start_date: '2022-07-01',
    end_date: null,
    is_current: true,
    responsibilities: '负责淘天集团用户&内容技术团队的前端开发工作，主要涉及个人看板系统、数据可视化平台等项目的架构设计和开发实现。\n\n参与团队技术选型和最佳实践制定，推动前端工程化建设。',
    projects: ['个人看板系统', '数据可视化平台', 'OneDay Agent'],
    salary: '40K * 16',
    created_at: '2022-07-01T00:00:00Z',
    updated_at: '2022-07-01T00:00:00Z'
  },
  {
    id: 'mock-2',
    company: '字节跳动',
    position: '前端工程师',
    start_date: '2020-03-01',
    end_date: '2022-06-30',
    is_current: false,
    responsibilities: '负责抖音创作者平台的前端开发，包括视频编辑器、数据分析看板等核心功能模块。\n\n优化页面性能，提升用户体验，参与多个重点项目的技术攻坚。',
    projects: ['视频编辑器', '创作者数据看板', '直播管理后台'],
    salary: '30K * 15',
    created_at: '2020-03-01T00:00:00Z',
    updated_at: '2020-03-01T00:00:00Z'
  },
  {
    id: 'mock-3',
    company: '腾讯科技',
    position: '初级前端工程师',
    start_date: '2018-07-01',
    end_date: '2020-02-28',
    is_current: false,
    responsibilities: '负责微信公众平台的前端开发和维护工作，参与多个功能模块的迭代开发。\n\n学习并实践React、Vue等主流前端框架，积累了丰富的项目经验。',
    projects: ['公众号管理后台', '素材管理系统', '数据统计平台'],
    salary: '18K * 14',
    created_at: '2018-07-01T00:00:00Z',
    updated_at: '2018-07-01T00:00:00Z'
  }
];

export default function Career() {
  const [careers, setCareers] = useState<Career[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showSalary, setShowSalary] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchCareers();
  }, []);

  const fetchCareers = async () => {
    try {
      const { data, error } = await supabase
        .from('career_timeline')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      const dbData = data || [];
      setCareers(dbData.length > 0 ? dbData : mockCareers);
    } catch (error) {
      console.error('Error fetching careers:', error);
      setCareers(mockCareers);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === PASSWORD) {
      setIsAuthenticated(true);
      setShowPasswordModal(false);
      setPasswordError('');
      setPassword('');
    } else {
      setPasswordError('密码错误，请重试');
    }
  };

  const toggleSalary = (id: string) => {
    if (!isAuthenticated) {
      setShowPasswordModal(true);
    } else {
      setShowSalary((prev) => ({ ...prev, [id]: !prev[id] }));
    }
  };

  if (loading) return <Loading />;

  if (careers.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase size={64} />}
        title="暂无职业记录"
        description="开始记录您的职业生涯"
      />
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-vintage-border" style={{ backgroundImage: 'repeating-linear-gradient(0deg, #D4C4B0, #D4C4B0 10px, transparent 10px, transparent 20px)' }} />

          <div className="space-y-8">
            {careers.map((career, index) => (
              <div key={career.id} className="relative pl-20">
                <div
                  className={`absolute left-5 w-6 h-6 rounded-full border-4 ${
                    career.is_current ? 'bg-vintage-red border-vintage-paper' : 'bg-vintage-brown border-vintage-paper'
                  }`}
                />

                <div className="vintage-card p-6">
                  <div className="vintage-number text-xs mb-3">
                    NO.{format(new Date(career.start_date), 'yyyyMM')}
                  </div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-vintage-dark mb-2">{career.position}</h3>
                      <div className="flex items-center gap-2 text-vintage-brown">
                        <MapPin size={16} />
                        <span className="font-medium">{career.company}</span>
                      </div>
                    </div>
                    {career.is_current && (
                      <div className="vintage-stamp">
                        当前
                      </div>
                    )}
                  </div>

                  <div className="vintage-divider"></div>

                  <div className="flex items-center gap-2 text-sm vintage-number mb-4 mt-3">
                    <Calendar size={16} />
                    <span>
                      {format(new Date(career.start_date), 'yyyy.MM')} -{' '}
                      {career.end_date ? format(new Date(career.end_date), 'yyyy.MM') : '至今'}
                    </span>
                  </div>

                  {career.responsibilities && (
                    <div className="mb-4">
                      <h4 className="text-sm font-bold text-vintage-dark mb-2">工作内容</h4>
                      <p className="text-vintage-brown text-sm whitespace-pre-wrap">{career.responsibilities}</p>
                    </div>
                  )}

                  {career.projects && career.projects.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-bold text-vintage-dark mb-2">负责项目</h4>
                      <div className="flex flex-wrap gap-2">
                        {career.projects.map((project, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-white text-vintage-dark text-sm rounded border-2 border-dashed border-vintage-border"
                          >
                            {project}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {career.salary && (
                    <div className="pt-4 border-t-2 border-dashed border-vintage-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign size={16} className="text-vintage-brown" />
                          <span className="text-sm font-bold text-vintage-dark">薪资</span>
                        </div>
                        <button
                          onClick={() => toggleSalary(career.id)}
                          className="flex items-center gap-2 px-3 py-1 text-sm text-vintage-red hover:bg-white rounded transition-colors border-2 border-dashed border-vintage-border"
                        >
                          {showSalary[career.id] ? (
                            <>
                              <EyeOff size={16} />
                              <span>隐藏</span>
                            </>
                          ) : (
                            <>
                              <Eye size={16} />
                              <span>查看</span>
                            </>
                          )}
                        </button>
                      </div>
                      {showSalary[career.id] && (
                        <div className="mt-2 text-vintage-dark font-bold vintage-number">{career.salary}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Modal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            setPasswordError('');
            setPassword('');
          }}
          title="验证密码"
          size="sm"
        >
          <form onSubmit={handlePasswordSubmit} className="p-6 bg-vintage-paper">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-4 text-vintage-brown">
                <Lock size={20} />
                <p className="text-sm">请输入密码以查看敏感信息</p>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-4 py-2 border-2 border-dashed border-vintage-border rounded bg-white focus:outline-none focus:border-vintage-red"
                autoFocus
              />
              {passwordError && (
                <p className="mt-2 text-sm text-vintage-red">{passwordError}</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-vintage-red text-white rounded hover:bg-vintage-dark transition-colors font-bold"
            >
              确认
            </button>
          </form>
        </Modal>
      </div>
    </div>
  );
}
