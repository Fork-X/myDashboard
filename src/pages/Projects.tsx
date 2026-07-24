import { useState, useEffect } from 'react';
import { supabase } from '../onedaycloud/client';
import { Tables } from '../onedaycloud/types';
import Card from '../components/common/Card';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import { Folder, Github, ExternalLink, Code } from 'lucide-react';

type Project = Tables<'projects'>;

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
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
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
