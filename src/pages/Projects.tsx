import { useState, useEffect } from 'react';
import { supabase } from '../onedaycloud/client';
import { Tables } from '../onedaycloud/types';
import Card from '../components/common/Card';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import { Folder, Github, ExternalLink, Code } from 'lucide-react';

type Project = Tables<'projects'>;

const mockProjects: Project[] = [
  {
    id: 'mock-1',
    name: '个人看板系统',
    description: '基于 React + TypeScript + Supabase 构建的复古风格个人管理系统，融合国风设计元素',
    tech_stack: ['React', 'TypeScript', 'Tailwind CSS', 'Supabase'],
    github_url: 'https://github.com/example/personal-dashboard',
    demo_url: 'https://demo.example.com',
    image_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'mock-2',
    name: '投资知识库',
    description: '整理和管理投资相关的知识、复盘和热点新闻，帮助建立系统化的投资思维框架',
    tech_stack: ['Vue 3', 'Vite', 'Element Plus', 'PostgreSQL'],
    github_url: 'https://github.com/example/investment-kb',
    image_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
    created_at: '2024-02-20T14:30:00Z',
    updated_at: '2024-02-20T14:30:00Z'
  },
  {
    id: 'mock-3',
    name: '职业发展时间轴',
    description: '记录职业生涯的重要节点和成长历程，可视化展示个人发展轨迹',
    tech_stack: ['Next.js', 'React', 'Prisma', 'MySQL'],
    demo_url: 'https://career.example.com',
    image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',
    created_at: '2024-03-10T09:15:00Z',
    updated_at: '2024-03-10T09:15:00Z'
  },
  {
    id: 'mock-4',
    name: '思维碎片收集器',
    description: '随时记录灵感、想法和思考，支持标签分类和全文搜索',
    tech_stack: ['Svelte', 'SvelteKit', 'SQLite'],
    github_url: 'https://github.com/example/thoughts-collector',
    demo_url: 'https://thoughts.example.com',
    image_url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80',
    created_at: '2024-04-05T16:45:00Z',
    updated_at: '2024-04-05T16:45:00Z'
  }
];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const dbProjects = data || [];
      setProjects(dbProjects.length > 0 ? dbProjects : mockProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects(mockProjects);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {projects.length === 0 ? (
          <EmptyState
            icon={<Folder size={64} />}
            title="暂无项目"
            description="开始添加您的个人项目和作品"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => (
              <Card key={project.id} number={String(index + 1).padStart(4, '0')} className="flex flex-col">
                {project.image_url && (
                  <div className="mb-4 -mx-6 -mt-6">
                    <img
                      src={project.image_url}
                      alt={project.name}
                      className="w-full h-48 object-cover rounded-t-lg border-b-2 border-dashed border-vintage-border"
                    />
                  </div>
                )}

                <h3 className="text-xl font-bold text-vintage-dark mb-2">{project.name}</h3>
                <div className="vintage-divider"></div>

                {project.description && (
                  <p className="text-vintage-brown text-sm mb-4 flex-1 mt-3">{project.description}</p>
                )}

                {project.tech_stack && project.tech_stack.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Code size={16} className="text-vintage-brown" />
                      <span className="text-sm font-bold text-vintage-dark">技术栈</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {project.tech_stack.map((tech, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-white text-vintage-dark text-xs rounded border-2 border-dashed border-vintage-border"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t-2 border-dashed border-vintage-border">
                  {project.github_url && (
                    <a
                      href={project.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-vintage-dark text-white rounded hover:bg-vintage-brown transition-colors text-sm flex-1 justify-center font-bold"
                    >
                      <Github size={16} />
                      <span>GitHub</span>
                    </a>
                  )}
                  {project.demo_url && (
                    <a
                      href={project.demo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-vintage-red text-white rounded hover:bg-vintage-dark transition-colors text-sm flex-1 justify-center font-bold"
                    >
                      <ExternalLink size={16} />
                      <span>演示</span>
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
