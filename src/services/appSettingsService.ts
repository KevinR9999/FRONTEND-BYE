// src/services/appSettingsService.ts
// Servicio liviano para leer configuración de app_settings (usado por páginas de estudiante)

import { supabase } from '../lib/supabaseClient';

export interface DiagnosticDistribution {
  [level: string]: number;
}

export interface SkillDistribution {
  [level: string]: { [skill: string]: number };
}

export interface AppSettings {
  min_score_to_pass: number;
  questions_per_lesson: number;
  diagnostic_time_limit: number;
  diagnostic_questions_total: number;
  diagnostic_questions_per_level: DiagnosticDistribution;
  diagnostic_skill_distribution: SkillDistribution | null;
  maintenance_mode: boolean;
}

const DEFAULT_DISTRIBUTION: DiagnosticDistribution = { A1: 13, A2: 13, B1: 12, B2: 12 };

const DEFAULTS: AppSettings = {
  min_score_to_pass: 80,
  questions_per_lesson: 15,
  diagnostic_time_limit: 20,
  diagnostic_questions_total: 50,
  diagnostic_questions_per_level: DEFAULT_DISTRIBUTION,
  diagnostic_skill_distribution: null,
  maintenance_mode: false,
};

// Cache en memoria (se refresca por sesión)
let cached: AppSettings | null = null;

export async function loadAppSettings(): Promise<AppSettings> {
  if (cached) return cached;

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

    cached = {
      min_score_to_pass: parseInt(map.min_score_to_pass) || DEFAULTS.min_score_to_pass,
      questions_per_lesson: parseInt(map.questions_per_lesson) || DEFAULTS.questions_per_lesson,
      diagnostic_time_limit: parseInt(map.diagnostic_time_limit) || DEFAULTS.diagnostic_time_limit,
      diagnostic_questions_total: parseInt(map.diagnostic_questions_total) || DEFAULTS.diagnostic_questions_total,
      diagnostic_questions_per_level: distribution,
      diagnostic_skill_distribution: skillDist,
      maintenance_mode: map.maintenance_mode === 'true',
    };

    return cached;
  } catch {
    return DEFAULTS;
  }
}

// Para forzar refresh (ej: después de guardar en admin)
export function clearSettingsCache() {
  cached = null;
}
