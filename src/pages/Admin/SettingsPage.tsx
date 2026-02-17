// src/pages/Admin/SettingsPage.tsx
import { useEffect, useState } from 'react';
import {
  Save,
  RefreshCw,
  Zap,
  Clock,
  Check,
  Shield,
  AlertTriangle,
  Target,
  ChevronDown,
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { getAppSettings, updateAppSetting } from '../../services/adminService';
import { clearSettingsCache } from '../../services/appSettingsService';

const LEVELS = ['A1', 'A2', 'B1', 'B2'];

const EXERCISE_TYPES = [
  { key: 'multiple_choice', label: 'Opción múltiple' },
  { key: 'fill_blank', label: 'Completar' },
  { key: 'speaking', label: 'Speaking' },
  { key: 'listening', label: 'Listening' },
  { key: 'word_order', label: 'Ordenar palabras' },
];

interface SkillDist {
  [level: string]: { [skill: string]: number };
}

interface AppConfig {
  min_score_to_pass: number;
  questions_per_lesson: number;
  diagnostic_time_limit: number;
  maintenance_mode: boolean;
}

const defaultConfig: AppConfig = {
  min_score_to_pass: 80,
  questions_per_lesson: 15,
  diagnostic_time_limit: 20,
  maintenance_mode: false,
};

/* ── helpers ── */

function distributeEvenly(total: number, count: number): number[] {
  if (count === 0) return [];
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

function autoSkillsForLevel(total: number): Record<string, number> {
  const values = distributeEvenly(total, EXERCISE_TYPES.length);
  const result: Record<string, number> = {};
  EXERCISE_TYPES.forEach((t, i) => { result[t.key] = values[i]; });
  return result;
}

function generateDefaultSkillDist(): SkillDist {
  return { A1: autoSkillsForLevel(13), A2: autoSkillsForLevel(13), B1: autoSkillsForLevel(12), B2: autoSkillsForLevel(12) };
}

function lvlTotal(skills: Record<string, number>): number {
  return Object.values(skills).reduce((a, b) => a + b, 0);
}

function getLevelColor(level: string) {
  switch (level) {
    case 'A1': return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' };
    case 'A2': return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' };
    case 'B1': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' };
    case 'B2': return { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' };
    default: return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' };
  }
}

function Switch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        enabled ? 'bg-slate-700' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

/* ── main component ── */

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [originalConfig, setOriginalConfig] = useState<AppConfig>(defaultConfig);
  const [skillDist, setSkillDist] = useState<SkillDist>(generateDefaultSkillDist());
  const [originalSkillDist, setOriginalSkillDist] = useState<SkillDist>(generateDefaultSkillDist());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);

  // String states for inputs (allows clearing)
  const [minScoreStr, setMinScoreStr] = useState('80');
  const [questionsStr, setQuestionsStr] = useState('15');
  const [timeLimitStr, setTimeLimitStr] = useState('20');
  const [totalStr, setTotalStr] = useState('50');
  const [skillStrs, setSkillStrs] = useState<Record<string, Record<string, string>>>({});

  const diagnosticTotal = LEVELS.reduce((sum, l) => sum + lvlTotal(skillDist[l] || {}), 0);

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => { setTotalStr(String(diagnosticTotal)); }, [diagnosticTotal]);

  /* ── load ── */
  const loadSettings = async () => {
    try {
      const settings = await getAppSettings();

      const loaded: AppConfig = {
        min_score_to_pass: parseInt(settings.min_score_to_pass) || defaultConfig.min_score_to_pass,
        questions_per_lesson: parseInt(settings.questions_per_lesson) || defaultConfig.questions_per_lesson,
        diagnostic_time_limit: parseInt(settings.diagnostic_time_limit) || defaultConfig.diagnostic_time_limit,
        maintenance_mode: settings.maintenance_mode === 'true',
      };

      // Load skill distribution (new format) or fall back to per-level totals
      let sd: SkillDist | null = null;
      try {
        if (settings.diagnostic_skill_distribution) {
          sd = JSON.parse(settings.diagnostic_skill_distribution);
        }
      } catch {}

      if (!sd) {
        let levelDist: Record<string, number> = { A1: 13, A2: 13, B1: 12, B2: 12 };
        try {
          if (settings.diagnostic_questions_per_level) {
            levelDist = JSON.parse(settings.diagnostic_questions_per_level);
          }
        } catch {}
        sd = {};
        for (const l of LEVELS) sd[l] = autoSkillsForLevel(levelDist[l] ?? 0);
      }

      setConfig(loaded);
      setOriginalConfig(loaded);
      setSkillDist(sd);
      setOriginalSkillDist(JSON.parse(JSON.stringify(sd)));

      setMinScoreStr(String(loaded.min_score_to_pass));
      setQuestionsStr(String(loaded.questions_per_lesson));
      setTimeLimitStr(String(loaded.diagnostic_time_limit));

      const strs: Record<string, Record<string, string>> = {};
      for (const l of LEVELS) {
        strs[l] = {};
        for (const t of EXERCISE_TYPES) strs[l][t.key] = String(sd[l]?.[t.key] ?? 0);
      }
      setSkillStrs(strs);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges =
    config.min_score_to_pass !== originalConfig.min_score_to_pass ||
    config.questions_per_lesson !== originalConfig.questions_per_lesson ||
    config.diagnostic_time_limit !== originalConfig.diagnostic_time_limit ||
    config.maintenance_mode !== originalConfig.maintenance_mode ||
    JSON.stringify(skillDist) !== JSON.stringify(originalSkillDist);

  /* ── redistribute total across levels + skills ── */
  const redistributeTotal = (newTotal: number) => {
    if (newTotal <= 0) return;
    const curTotal = diagnosticTotal || 1;
    const newDist: SkillDist = {};
    let accumulated = 0;

    LEVELS.forEach((l, i) => {
      const curLvl = lvlTotal(skillDist[l] || {});
      let newLvl: number;
      if (i === LEVELS.length - 1) {
        newLvl = Math.max(0, newTotal - accumulated);
      } else {
        newLvl = Math.round((curLvl / curTotal) * newTotal);
        accumulated += newLvl;
      }
      newDist[l] = autoSkillsForLevel(newLvl);
    });

    setSkillDist(newDist);
    const strs: Record<string, Record<string, string>> = {};
    for (const l of LEVELS) {
      strs[l] = {};
      for (const t of EXERCISE_TYPES) strs[l][t.key] = String(newDist[l]?.[t.key] ?? 0);
    }
    setSkillStrs(strs);
  };

  /* ── skill input change ── */
  const updateSkill = (level: string, skill: string, strVal: string) => {
    setSkillStrs(prev => ({ ...prev, [level]: { ...prev[level], [skill]: strVal } }));
    const n = parseInt(strVal);
    if (!isNaN(n) && n >= 0) {
      setSkillDist(prev => ({ ...prev, [level]: { ...prev[level], [skill]: Math.max(0, Math.min(50, n)) } }));
    }
  };

  const blurSkill = (level: string, skill: string) => {
    const n = parseInt(skillStrs[level]?.[skill]) || 0;
    const clamped = Math.max(0, Math.min(50, n));
    setSkillDist(prev => ({ ...prev, [level]: { ...prev[level], [skill]: clamped } }));
    setSkillStrs(prev => ({ ...prev, [level]: { ...prev[level], [skill]: String(clamped) } }));
  };

  /* ── redistribute skills within a level (even) ── */
  const redistributeLevelSkills = (level: string, total: number) => {
    const newSkills = autoSkillsForLevel(total);
    setSkillDist(prev => ({ ...prev, [level]: newSkills }));
    const strs: Record<string, string> = {};
    for (const t of EXERCISE_TYPES) strs[t.key] = String(newSkills[t.key] ?? 0);
    setSkillStrs(prev => ({ ...prev, [level]: strs }));
  };

  /* ── save ── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: [string, string][] = [];

      if (config.min_score_to_pass !== originalConfig.min_score_to_pass)
        updates.push(['min_score_to_pass', String(config.min_score_to_pass)]);
      if (config.questions_per_lesson !== originalConfig.questions_per_lesson)
        updates.push(['questions_per_lesson', String(config.questions_per_lesson)]);
      if (config.diagnostic_time_limit !== originalConfig.diagnostic_time_limit)
        updates.push(['diagnostic_time_limit', String(config.diagnostic_time_limit)]);
      if (config.maintenance_mode !== originalConfig.maintenance_mode)
        updates.push(['maintenance_mode', String(config.maintenance_mode)]);

      if (JSON.stringify(skillDist) !== JSON.stringify(originalSkillDist)) {
        updates.push(['diagnostic_skill_distribution', JSON.stringify(skillDist)]);
        const perLevel: Record<string, number> = {};
        for (const l of LEVELS) perLevel[l] = lvlTotal(skillDist[l] || {});
        updates.push(['diagnostic_questions_per_level', JSON.stringify(perLevel)]);
        updates.push(['diagnostic_questions_total', String(diagnosticTotal)]);
      }

      await Promise.all(updates.map(([key, val]) => updateAppSetting(key, val)));

      clearSettingsCache();
      setOriginalConfig({ ...config });
      setOriginalSkillDist(JSON.parse(JSON.stringify(skillDist)));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  /* ── reset ── */
  const handleReset = () => {
    setConfig({ ...originalConfig });
    setSkillDist(JSON.parse(JSON.stringify(originalSkillDist)));
    setMinScoreStr(String(originalConfig.min_score_to_pass));
    setQuestionsStr(String(originalConfig.questions_per_lesson));
    setTimeLimitStr(String(originalConfig.diagnostic_time_limit));
    const strs: Record<string, Record<string, string>> = {};
    for (const l of LEVELS) {
      strs[l] = {};
      for (const t of EXERCISE_TYPES) strs[l][t.key] = String(originalSkillDist[l]?.[t.key] ?? 0);
    }
    setSkillStrs(strs);
  };

  if (loading) {
    return (
      <AdminLayout title="Configuración" subtitle="Ajustes generales de la aplicación">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  const inputClass = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900';

  return (
    <AdminLayout title="Configuración" subtitle="Ajustes generales de la aplicación">
      <div className="max-w-2xl space-y-6">
        {/* ── Lecciones ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100">
              <Zap size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Lecciones</h2>
              <p className="text-xs text-slate-500">Configuración de lecciones</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Porcentaje mínimo para aprobar
                </label>
                <input
                  type="number"
                  value={minScoreStr}
                  onChange={(e) => {
                    setMinScoreStr(e.target.value);
                    const n = parseInt(e.target.value);
                    if (!isNaN(n)) setConfig(prev => ({ ...prev, min_score_to_pass: Math.max(50, Math.min(100, n)) }));
                  }}
                  onBlur={() => {
                    const n = parseInt(minScoreStr) || originalConfig.min_score_to_pass;
                    const clamped = Math.max(50, Math.min(100, n));
                    setConfig(prev => ({ ...prev, min_score_to_pass: clamped }));
                    setMinScoreStr(String(clamped));
                  }}
                  min={50} max={100}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-400">Actualmente: {config.min_score_to_pass}%</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Preguntas por intento
                </label>
                <input
                  type="number"
                  value={questionsStr}
                  onChange={(e) => {
                    setQuestionsStr(e.target.value);
                    const n = parseInt(e.target.value);
                    if (!isNaN(n)) setConfig(prev => ({ ...prev, questions_per_lesson: Math.max(5, Math.min(30, n)) }));
                  }}
                  onBlur={() => {
                    const n = parseInt(questionsStr) || originalConfig.questions_per_lesson;
                    const clamped = Math.max(5, Math.min(30, n));
                    setConfig(prev => ({ ...prev, questions_per_lesson: clamped }));
                    setQuestionsStr(String(clamped));
                  }}
                  min={5} max={30}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-400">Actualmente: {config.questions_per_lesson} preguntas</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Prueba Diagnóstica ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-100">
              <Target size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Prueba Diagnóstica</h2>
              <p className="text-xs text-slate-500">Configuración del test inicial</p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            {/* Tiempo + Total */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <Clock size={14} className="inline mr-1.5 text-slate-400" />
                  Tiempo límite (min)
                </label>
                <input
                  type="number"
                  value={timeLimitStr}
                  onChange={(e) => {
                    setTimeLimitStr(e.target.value);
                    const n = parseInt(e.target.value);
                    if (!isNaN(n)) setConfig(prev => ({ ...prev, diagnostic_time_limit: Math.max(10, Math.min(60, n)) }));
                  }}
                  onBlur={() => {
                    const n = parseInt(timeLimitStr) || originalConfig.diagnostic_time_limit;
                    const clamped = Math.max(10, Math.min(60, n));
                    setConfig(prev => ({ ...prev, diagnostic_time_limit: clamped }));
                    setTimeLimitStr(String(clamped));
                  }}
                  min={10} max={60}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Total de preguntas
                </label>
                <input
                  type="number"
                  value={totalStr}
                  onChange={(e) => {
                    setTotalStr(e.target.value);
                    const n = parseInt(e.target.value);
                    if (!isNaN(n) && n > 0 && n <= 200) {
                      redistributeTotal(n);
                    }
                  }}
                  onBlur={() => {
                    const n = parseInt(totalStr) || diagnosticTotal;
                    const clamped = Math.max(4, Math.min(200, n));
                    if (clamped !== diagnosticTotal) redistributeTotal(clamped);
                    setTotalStr(String(clamped));
                  }}
                  min={4} max={200}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-400">Se redistribuyen automáticamente</p>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Distribución por nivel (acordeón) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">
                  Distribución por nivel y tipo
                </label>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                  diagnosticTotal > 0 ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-600'
                }`}>
                  Total: {diagnosticTotal}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Toca un nivel para elegir cuántas preguntas de cada tipo de ejercicio.
              </p>

              <div className="space-y-2">
                {LEVELS.map((level) => {
                  const colors = getLevelColor(level);
                  const total = lvlTotal(skillDist[level] || {});
                  const isOpen = expandedLevel === level;

                  return (
                    <div key={level} className={`rounded-xl border ${colors.border} overflow-hidden`}>
                      {/* Header */}
                      <button
                        type="button"
                        onClick={() => setExpandedLevel(isOpen ? null : level)}
                        className={`w-full flex items-center justify-between px-4 py-3 ${colors.bg} hover:opacity-90 transition-opacity`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${colors.text}`}>Nivel {level}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white/60 ${colors.text}`}>
                            {total} preguntas
                          </span>
                        </div>
                        <ChevronDown
                          size={16}
                          className={`${colors.text} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {/* Expanded: skill inputs */}
                      {isOpen && (
                        <div className="px-4 py-3 bg-white border-t border-slate-100 space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {EXERCISE_TYPES.map((type) => (
                              <div key={type.key}>
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                  {type.label}
                                </label>
                                <input
                                  type="number"
                                  value={skillStrs[level]?.[type.key] ?? '0'}
                                  onChange={(e) => updateSkill(level, type.key, e.target.value)}
                                  onBlur={() => blurSkill(level, type.key)}
                                  min={0} max={50}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-900 text-center outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            <button
                              type="button"
                              onClick={() => redistributeLevelSkills(level, total)}
                              className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline"
                            >
                              Redistribuir parejo
                            </button>
                            <span className="text-xs font-medium text-slate-500">
                              Subtotal: {total}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {diagnosticTotal === 0 && (
                <p className="mt-2 text-xs text-red-500 font-medium">
                  Debes asignar al menos 1 pregunta en algún nivel.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── General ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100">
              <Shield size={20} className="text-slate-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">General</h2>
              <p className="text-xs text-slate-500">Configuración general de la app</p>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className={config.maintenance_mode ? 'text-amber-500' : 'text-slate-400'} />
                <div>
                  <p className="text-sm font-medium text-slate-700">Modo mantenimiento</p>
                  <p className="text-xs text-slate-500">Desactiva el acceso a la app temporalmente</p>
                </div>
              </div>
              <Switch
                enabled={config.maintenance_mode}
                onChange={() => setConfig(prev => ({ ...prev, maintenance_mode: !prev.maintenance_mode }))}
              />
            </div>
            {config.maintenance_mode && (
              <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-700">
                  Los estudiantes verán un mensaje de mantenimiento al intentar acceder.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} />
            <span>Descartar cambios</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges || diagnosticTotal === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Guardando...</span>
              </>
            ) : saved ? (
              <>
                <Check size={18} />
                <span>Guardado</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
