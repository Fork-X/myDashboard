import Card from '../components/common/Card';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { useRecords } from '../hooks/useRecords';
import { Folder, Github, ExternalLink, Code } from 'lucide-react';

export default function Projects() {
  const { data, loading, error } = useRecords('project');
  const projects = data.map((record) => {
    const payload = record.payload;
    return {
      id: record.id,
      name: record.title,
      description: record.content,
      techStack: payload.techStack,
      repositoryUrl: payload.repositoryUrl,
      demoUrl: payload.demoUrl,
      currentFocus: payload.currentFocus,
    };
  });

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <ErrorState message={error} />
        </div>
      </div>
    );
  }

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
                <div
                  aria-hidden="true"
                  className="mb-4 -mx-6 -mt-6 h-48 rounded-t-lg border-b-2 border-dashed border-vintage-border bg-vintage-brown bg-opacity-10 relative overflow-hidden"
                >
                  <div className="absolute inset-4 rounded border-2 border-dashed border-vintage-border flex items-center justify-center">
                    <Folder className="text-vintage-brown opacity-30" size={48} />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-vintage-dark mb-2">{project.name}</h3>
                <div className="vintage-divider"></div>

                {project.description && (
                  <p className="text-vintage-brown text-sm mb-4 flex-1 mt-3">{project.description}</p>
                )}

                {project.currentFocus && (
                  <div className="mb-4">
                    <span className="text-sm font-bold text-vintage-dark">当前重点</span>
                    <p className="text-vintage-brown text-sm mt-1">{project.currentFocus}</p>
                  </div>
                )}

                {project.techStack.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Code size={16} className="text-vintage-brown" />
                      <span className="text-sm font-bold text-vintage-dark">技术栈</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {project.techStack.map((tech, idx) => (
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
                  {project.repositoryUrl && (
                    <a
                      href={project.repositoryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-vintage-dark text-white rounded hover:bg-vintage-brown transition-colors text-sm flex-1 justify-center font-bold"
                    >
                      <Github size={16} />
                      <span>GitHub</span>
                    </a>
                  )}
                  {project.demoUrl && (
                    <a
                      href={project.demoUrl}
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
