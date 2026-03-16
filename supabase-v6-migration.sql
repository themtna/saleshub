-- ╔══════════════════════════════════════════════════════════════╗
-- ║  V6 — หัวหน้าแก้ไข/ลบออเดอร์ได้                             ║
-- ║  รัน SQL นี้ใน Supabase SQL Editor                           ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Manager UPDATE orders
DO $$ BEGIN
  CREATE POLICY "manager_update_orders" ON orders
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Manager DELETE orders
DO $$ BEGIN
  CREATE POLICY "manager_delete_orders" ON orders
    FOR DELETE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- เพิ่มคอลัมน์ province (ถ้ายังไม่มี)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS province TEXT DEFAULT '';
