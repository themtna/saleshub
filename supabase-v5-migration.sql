-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SalesHub V5 — อัพโหลดสลิป + ประเภทการชำระเงิน               ║
-- ║  รัน SQL นี้ใน Supabase SQL Editor                           ║
-- ╚══════════════════════════════════════════════════════════════╝

-- เพิ่มคอลัมน์ใหม่ในตาราง orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'cod';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS slip_url TEXT DEFAULT '';

-- สร้าง Storage bucket สำหรับเก็บสลิป
INSERT INTO storage.buckets (id, name, public) VALUES ('slips', 'slips', true)
ON CONFLICT (id) DO NOTHING;

-- ให้ทุกคน upload ได้
CREATE POLICY "anyone_upload_slip" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'slips');

-- ให้ทุกคนดูสลิปได้
CREATE POLICY "anyone_view_slip" ON storage.objects
  FOR SELECT USING (bucket_id = 'slips');

-- เพิ่มคอลัมน์จังหวัด
ALTER TABLE orders ADD COLUMN IF NOT EXISTS province TEXT DEFAULT '';
