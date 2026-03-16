-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SalesHub V3 — Manager สร้างบัญชีพนักงานได้                   ║
-- ║  รัน SQL นี้ใน Supabase SQL Editor                           ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ลบ policy เดิมที่จำกัดแค่สร้างตัวเอง แล้วสร้างใหม่
DROP POLICY IF EXISTS "create_own_profile" ON profiles;
DROP POLICY IF EXISTS "manager_create_profiles" ON profiles;

-- ให้ manager สร้าง profile ให้คนอื่นได้ + สร้างตัวเองได้
CREATE POLICY "create_profiles" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- ให้ manager ดูและแก้ไข profile ทุกคนได้
CREATE POLICY "manager_update_profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
    OR auth.uid() = id
  );

-- เพิ่มคอลัมน์ sales_channel ในตาราง orders (ถ้ายังไม่มี)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'sales_channel') THEN
    ALTER TABLE orders ADD COLUMN sales_channel TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_social') THEN
    ALTER TABLE orders ADD COLUMN customer_social TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'employee_name') THEN
    ALTER TABLE orders ADD COLUMN employee_name TEXT DEFAULT '';
  END IF;
END $$;
