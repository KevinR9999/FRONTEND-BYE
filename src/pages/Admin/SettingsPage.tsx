// src/pages/Admin/SettingsPage.tsx
import { useState } from 'react';
import {
  Save,
  RefreshCw,
  Smartphone,
  Bell,
  Shield,
  Zap,
  Award,
  Clock,
  Check
} from 'lucide-react';
import AdminLayout from './AdminLayout';

interface AppConfig {
  appName: string;
  xpPerCorrectAnswer: number;
  xpPerLessonComplete: number;
  streakDaysToLose: number;
  minScoreToPass: number;
  questionsPerLesson: number;
  diagnosticQuestions: number;
  diagnosticTimeLimit: number;
  enableNotifications: boolean;
  enableOfflineMode: boolean;
  enableSounds: boolean;
  maintenanceMode: boolean;
}

const defaultConfig: AppConfig = {
  appName: 'BYE - Boost Your English',
  xpPerCorrectAnswer: 10,
  xpPerLessonComplete: 50,
  streakDaysToLose: 1,
  minScoreToPass: 80,
  questionsPerLesson: 15,
  diagnosticQuestions: 30,
  diagnosticTimeLimit: 20,
  enableNotifications: true,
  enableOfflineMode: false,
  enableSounds: true,
  maintenanceMode: false,
};

function Switch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
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

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Simular guardado - en producción guardarías en Supabase
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setConfig(defaultConfig);
  };

  const updateConfig = (key: keyof AppConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <AdminLayout title="Configuración" subtitle="Ajustes generales de la aplicación">
      <div className="max-w-2xl space-y-6">
        {/* General */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100">
              <Smartphone size={20} className="text-slate-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">General</h2>
              <p className="text-xs text-slate-500">Configuración básica de la app</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nombre de la App
              </label>
              <input
                type="text"
                value={config.appName}
                onChange={(e) => updateConfig('appName', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-slate-700">Modo mantenimiento</p>
                <p className="text-xs text-slate-500">Desactiva el acceso a la app temporalmente</p>
              </div>
              <Switch
                enabled={config.maintenanceMode}
                onChange={() => updateConfig('maintenanceMode', !config.maintenanceMode)}
              />
            </div>
          </div>
        </div>

        {/* Gamification */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-yellow-100">
              <Award size={20} className="text-yellow-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Gamificación</h2>
              <p className="text-xs text-slate-500">Configuración de XP y logros</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  XP por respuesta correcta
                </label>
                <input
                  type="number"
                  value={config.xpPerCorrectAnswer}
                  onChange={(e) => updateConfig('xpPerCorrectAnswer', parseInt(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  XP bonus por completar lección
                </label>
                <input
                  type="number"
                  value={config.xpPerLessonComplete}
                  onChange={(e) => updateConfig('xpPerLessonComplete', parseInt(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Días sin practicar para perder racha
              </label>
              <input
                type="number"
                value={config.streakDaysToLose}
                onChange={(e) => updateConfig('streakDaysToLose', parseInt(e.target.value))}
                min={1}
                max={7}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Lessons */}
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
                  Preguntas por intento
                </label>
                <input
                  type="number"
                  value={config.questionsPerLesson}
                  onChange={(e) => updateConfig('questionsPerLesson', parseInt(e.target.value))}
                  min={5}
                  max={30}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Porcentaje mínimo para aprobar
                </label>
                <input
                  type="number"
                  value={config.minScoreToPass}
                  onChange={(e) => updateConfig('minScoreToPass', parseInt(e.target.value))}
                  min={50}
                  max={100}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm"
                />
                <p className="mt-1 text-xs text-slate-400">Actualmente: {config.minScoreToPass}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-100">
              <Clock size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Prueba Diagnóstica</h2>
              <p className="text-xs text-slate-500">Configuración del test inicial</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Número de preguntas
                </label>
                <input
                  type="number"
                  value={config.diagnosticQuestions}
                  onChange={(e) => updateConfig('diagnosticQuestions', parseInt(e.target.value))}
                  min={10}
                  max={50}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tiempo límite (minutos)
                </label>
                <input
                  type="number"
                  value={config.diagnosticTimeLimit}
                  onChange={(e) => updateConfig('diagnosticTimeLimit', parseInt(e.target.value))}
                  min={10}
                  max={60}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100">
              <Shield size={20} className="text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Funcionalidades</h2>
              <p className="text-xs text-slate-500">Activar o desactivar características</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell size={18} className="text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Notificaciones</p>
                  <p className="text-xs text-slate-500">Enviar notificaciones push a usuarios</p>
                </div>
              </div>
              <Switch
                enabled={config.enableNotifications}
                onChange={() => updateConfig('enableNotifications', !config.enableNotifications)}
              />
            </div>
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone size={18} className="text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Modo Offline</p>
                  <p className="text-xs text-slate-500">Permitir uso sin conexión</p>
                </div>
              </div>
              <Switch
                enabled={config.enableOfflineMode}
                onChange={() => updateConfig('enableOfflineMode', !config.enableOfflineMode)}
              />
            </div>
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap size={18} className="text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Sonidos</p>
                  <p className="text-xs text-slate-500">Efectos de sonido en la app</p>
                </div>
              </div>
              <Switch
                enabled={config.enableSounds}
                onChange={() => updateConfig('enableSounds', !config.enableSounds)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw size={18} />
            <span>Restablecer</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
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
