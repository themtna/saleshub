-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SalesHub V4 — Manager แก้ไข/ลบทีม + เปลี่ยนทีมพนักงาน       ║
-- ║  รัน SQL นี้ใน Supabase SQL Editor                           ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Manager แก้ไขชื่อทีมได้
CREATE POLICY "manager_update_team" ON teams
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- Manager ลบทีมได้
CREATE POLICY "manager_delete_team" ON teams
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- Manager แก้ไข profile (เปลี่ยนทีม) ได้
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
DROP POLICY IF EXISTS "manager_update_profiles" ON profiles;

CREATE POLICY "update_profiles" ON profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );
