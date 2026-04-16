// src/services/appSettingsService.ts
// Servicio liviano para leer configuración de app_settings (usado por páginas de estudiante)

import { supabase } from '../lib/supabaseClient';

export interface DiagnosticDistribution {
  [level: string]: number;
}

export interface SkillDistribution {
  [level: string]: { [skill: string]: number };
}

export interface LevelThresholds {
  A2: number;
  B1: number;
  B2: number;
}

export interface AppSettings {
  min_score_to_pass: number;
  questions_per_lesson: number;
  diagnostic_time_limit: number;
  diagnostic_questions_total: number;
  diagnostic_questions_per_level: DiagnosticDistribution;
  diagnostic_skill_distribution: SkillDistribution | null;
  diagnostic_level_thresholds: LevelThresholds;
  maintenance_mode: boolean;
  maintenance_message: string;
}

const DEFAULT_DISTRIBUTION: DiagnosticDistribution = { A1: 13, A2: 13, B1: 12, B2: 12 };

const DEFAULT_THRESHOLDS: LevelThresholds = { A2: 40, B1: 60, B2: 80 };

const DEFAULTS: AppSettings = {
  min_score_to_pass: 80,
  questions_per_lesson: 15,
  diagnostic_time_limit: 20,
  diagnostic_questions_total: 50,
  diagnostic_questions_per_level: DEFAULT_DISTRIBUTION,
  diagnostic_skill_distribution: null,
  diagnostic_level_thresholds: DEFAULT_THRESHOLDS,
  maintenance_mode: false,
  maintenance_message: 'La aplicación está en mantenimiento. Vuelve pronto.',
};

// Cache en memoria con TTL de 60 segundos
let cached: AppSettings | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function loadAppSettings(): Promise<AppSettings> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value');

    if (error || !data) return DEFAULTS;

    const map: Record<string, string> = {};
    for (const row of data) map[row.key] = row.value;

    let distribution = DEFAULT_DISTRIBUTION;
    try {
      if (map.diagnostic_questions_per_level) {
        distribution = JSON.parse(map.diagnostic_questions_per_level);
      }
    } catch {}

    let skillDist: SkillDistribution | null = null;
    try {
      if (map.diagnostic_skill_distribution) {
        skillDist = JSON.parse(map.diagnostic_skill_distribution);
      }
    } catch {}

    let thresholds: LevelThresholds = DEFAULT_THRESHOLDS;
    try {
      if (map.diagnostic_level_thresholds) {
        thresholds = JSON.parse(map.diagnostic_level_thresholds);
      }
    } catch {}

    cachedAt = Date.now();
    cached = {
      min_score_to_pass: parseInt(map.min_score_to_pass) || DEFAULTS.min_score_to_pass,
      questions_per_lesson: parseInt(map.questions_per_lesson) || DEFAULTS.questions_per_lesson,
      diagnostic_time_limit: parseInt(map.diagnostic_time_limit) || DEFAULTS.diagnostic_time_limit,
      diagnostic_questions_total: parseInt(map.diagnostic_questions_total) || DEFAULTS.diagnostic_questions_total,
      diagnostic_questions_per_level: distribution,
      diagnostic_skill_distribution: skillDist,
      diagnostic_level_thresholds: thresholds,
      maintenance_mode: map.maintenance_mode === 'true',
      maintenance_message: map.maintenance_message || DEFAULTS.maintenance_message,
    };

    return cached;
  } catch {
    return DEFAULTS;
  }
}

// Para forzar refresh (ej: después de guardar en admin)
export function clearSettingsCache() {
  cached = null;
  cachedAt = 0;
}
