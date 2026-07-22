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

  if (projects.length === 0) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <EmptyState
            icon={<Folder size={64} />}
            title="暂无项目"
            description="开始添加您的个人项目和作品"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="flex flex-col">
              {project.image_url && (
                <div className="mb-4 -mx-6 -mt-6">
                  <img
                    src={project.image_url}
                    alt={project.name}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                </div>
              )}

              <h3 className="text-xl font-bold text-gray-900 mb-2">{project.name}</h3>

              {project.description && (
                <p className="text-gray-600 text-sm mb-4 flex-1">{project.description}</p>
              )}

              {project.tech_stack && project.tech_stack.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Code size={16} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">技术栈</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {project.tech_stack.map((tech, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                {project.github_url && (
                  <a
                    href={project.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm flex-1 justify-center"
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
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex-1 justify-center"
                  >
                    <ExternalLink size={16} />
                    <span>演示</span>
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
