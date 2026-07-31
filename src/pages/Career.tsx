import { format } from 'date-fns';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { useRecords } from '../hooks/useRecords';
import { Briefcase, MapPin, Calendar } from 'lucide-react';

export default function Career() {
  const { data, loading, error } = useRecords('career');

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <ErrorState message={error} />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
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
            {data.map((career) => {
              const payload = career.payload;

              return (
                <div key={career.id} className="relative pl-20">
                  <div
                    className={`absolute left-5 w-6 h-6 rounded-full border-4 ${
                      payload.isCurrent ? 'bg-vintage-red border-vintage-paper' : 'bg-vintage-brown border-vintage-paper'
                    }`}
                  />

                  <div className="vintage-card p-6">
                    <div className="vintage-number text-xs mb-3">
                      NO.{format(new Date(payload.startDate), 'yyyyMM')}
                    </div>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-vintage-dark mb-2">{payload.position}</h3>
                        <div className="flex items-center gap-2 text-vintage-brown">
                          <MapPin size={16} />
                          <span className="font-medium">{payload.companyAlias}</span>
                        </div>
                      </div>
                      {payload.isCurrent && (
                        <div className="vintage-stamp">
                          当前
                        </div>
                      )}
                    </div>

                    <div className="vintage-divider"></div>

                    <div className="flex items-center gap-2 text-sm vintage-number mb-4 mt-3">
                      <Calendar size={16} />
                      <span>
                        {payload.startDate} - {payload.endDate ?? '至今'}
                      </span>
                    </div>

                    <div className="mb-4">
                      <h4 className="text-sm font-bold text-vintage-dark mb-2">工作内容</h4>
                      <p className="text-vintage-brown text-sm whitespace-pre-wrap">{payload.responsibilities}</p>
                    </div>

                    {payload.projects.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-bold text-vintage-dark mb-2">负责项目</h4>
                        <div className="flex flex-wrap gap-2">
                          {payload.projects.map((project, idx) => (
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
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
