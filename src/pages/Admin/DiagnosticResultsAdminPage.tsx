// src/pages/Admin/DiagnosticResultsAdminPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, Eye, User } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { supabase } from '../../lib/supabaseClient';

interface DiagnosticResult {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  correct_answers: number;
  level: string;
  created_at: string;
}

const LEVEL_COLORS: Record<string, string> = {
  A1: 'bg-green-100 text-green-700',
  A2: 'bg-blue-100 text-blue-700',
  B1: 'bg-yellow-100 text-yellow-700',
  B2: 'bg-purple-100 text-purple-700',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DiagnosticResultsAdminPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      const { data, error } = await supabase
        .from('diagnostic_results')
        .select('id, user_id, user_name, user_email, correct_answers, level, created_at')
        .order('created_at', { ascending: false });
      if (!error && data) setResults(data);
    } catch (e) {
      console.error('Error cargando resultados:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Resultados Diagnóstico"
      subtitle={`${results.length} prueba${results.length !== 1 ? 's' : ''} completada${results.length !== 1 ? 's' : ''}`}
    >
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <BarChart2 size={44} className="mx-auto mb-3 opacity-25" />
            <p className="font-medium">Aún no hay resultados</p>
            <p className="text-sm mt-1">Aparecerán aquí cuando los estudiantes completen la prueba</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {results.map((r) => {
              const skipped = r.correct_answers === 0;
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-slate-50/60 transition-colors">
                  {/* Avatar + info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-semibold flex-shrink-0">
                      {(r.user_name || r.user_email)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {r.user_name || 'Sin nombre'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{r.user_email}</p>
                      <p className="text-xs text-slate-400 sm:hidden mt-0.5">{formatDate(r.created_at)}</p>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="hidden sm:inline text-xs text-slate-400">{formatDate(r.created_at)}</span>

                    {skipped ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700">
                        <User size={12} />
                        Omitió
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-slate-700">
                        {r.correct_answers} correctas
                      </span>
                    )}

                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${LEVEL_COLORS[r.level] ?? 'bg-slate-100 text-slate-600'}`}>
                      {r.level}
                    </span>

                    <button
                      onClick={() => navigate(`/admin/diagnostic-results/${r.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Eye size={14} />
                      <span className="hidden sm:inline">Ver respuestas</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
