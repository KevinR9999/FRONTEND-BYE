-- ============================================================
-- RLS POLICIES FALTANTES - Solo tablas sin policies
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 1. ACHIEVEMENTS (actualmente UNRESTRICTED)
-- La app lee logros desde achievementService.ts
-- Solo admins deberían poder crear/modificar logros
-- ============================================================
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievements_select_authenticated" ON achievements
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "achievements_insert_admin" ON achievements
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "achievements_update_admin" ON achievements
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "achievements_delete_admin" ON achievements
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 2. USER_ACHIEVEMENTS (tiene RLS habilitado pero 0 policies!)
-- Esto significa que NADIE puede acceder a esta tabla ahora.
-- El estudiante lee sus logros y los desbloquea al completar lecciones.
-- ============================================================

-- El usuario lee sus propios logros desbloqueados
CREATE POLICY "user_achievements_select_own" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

-- Admins leen todos los logros (ranking de logros en admin)
CREATE POLICY "user_achievements_select_admin" ON user_achievements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- El usuario desbloquea sus propios logros
CREATE POLICY "user_achievements_insert_own" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- El usuario marca logros como vistos (seen = true)
CREATE POLICY "user_achievements_update_own" ON user_achievements
  FOR UPDATE USING (auth.uid() = user_id);
