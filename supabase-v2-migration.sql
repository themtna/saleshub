-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SalesHub V2 — อัพเดท Database                              ║
-- ║  รัน SQL นี้ใน Supabase SQL Editor (หลังจากรัน schema เดิม)  ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── ลบตาราง orders เดิม แล้วสร้างใหม่ ──────────────────────

DROP TRIGGER IF EXISTS no_order_update ON orders;
DROP TRIGGER IF EXISTS no_order_delete ON orders;
DROP TABLE IF EXISTS orders CASCADE;

-- ── ตาราง orders ใหม่ (ตามรูปแบบ ProShip) ──────────────────

CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- เลขออเดอร์ รันใหม่ทุกวัน เช่น 20250315-001, 20250315-002
  order_number TEXT NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_seq INTEGER NOT NULL DEFAULT 1,

  -- ข้อมูลลูกค้า
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  sub_district TEXT,
  district TEXT,
  zip_code TEXT,

  -- ช่องทาง
  customer_social TEXT,
  sales_channel TEXT,

  -- ยอดเงิน
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cod_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- หมายเหตุ
  remark TEXT,

  -- ผู้สร้าง
  employee_id UUID REFERENCES profiles(id) NOT NULL,
  team_id UUID REFERENCES teams(id) NOT NULL,
  employee_name TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),

  -- ป้องกันเลขซ้ำ
  UNIQUE(order_date, daily_seq)
);

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX idx_orders_date ON orders(order_date DESC);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_employee ON orders(employee_id);
CREATE INDEX idx_orders_team ON orders(team_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- ── Function: สร้างเลขออเดอร์อัตโนมัติ ─────────────────────

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  next_seq INTEGER;
  date_str TEXT;
BEGIN
  -- หาลำดับถัดไปของวันนี้
  SELECT COALESCE(MAX(daily_seq), 0) + 1
  INTO next_seq
  FROM orders
  WHERE order_date = NEW.order_date;

  -- สร้างเลขออเดอร์ เช่น 20250315-001
  date_str := TO_CHAR(NEW.order_date, 'YYYYMMDD');
  NEW.daily_seq := next_seq;
  NEW.order_number := date_str || '-' || LPAD(next_seq::TEXT, 3, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- ── ป้องกันแก้ไข/ลบ ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION prevent_order_update() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'ไม่สามารถแก้ไขออเดอร์ได้'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER no_order_update BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION prevent_order_update();

CREATE OR REPLACE FUNCTION prevent_order_delete() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'ไม่สามารถลบออเดอร์ได้'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER no_order_delete BEFORE DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION prevent_order_delete();

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_read_orders" ON orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

CREATE POLICY "employee_read_team_orders" ON orders
  FOR SELECT USING (
    team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "employee_create_order" ON orders
  FOR INSERT WITH CHECK (auth.uid() = employee_id);

-- ── Realtime ─────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- ── Report Functions (อัพเดท) ────────────────────────────────

-- ยอดขายตามวันที่
CREATE OR REPLACE FUNCTION get_orders_by_date(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  sale_price NUMERIC,
  cod_amount NUMERIC,
  sales_channel TEXT,
  employee_name TEXT,
  remark TEXT,
  created_at TIMESTAMPTZ
) AS $$
SELECT
  o.id, o.order_number, o.customer_name, o.customer_phone,
  o.sale_price, o.cod_amount, o.sales_channel, o.employee_name,
  o.remark, o.created_at
FROM orders o
WHERE o.order_date = target_date
ORDER BY o.daily_seq;
$$ LANGUAGE sql SECURITY DEFINER;

-- สรุปยอดขายรายวัน
CREATE OR REPLACE FUNCTION get_daily_summary(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_orders BIGINT,
  total_sales NUMERIC,
  total_cod NUMERIC,
  team_name TEXT,
  team_orders BIGINT,
  team_sales NUMERIC
) AS $$
SELECT
  COUNT(o.id),
  COALESCE(SUM(o.sale_price), 0),
  COALESCE(SUM(o.cod_amount), 0),
  t.name,
  COUNT(o.id),
  COALESCE(SUM(o.sale_price), 0)
FROM orders o
JOIN teams t ON o.team_id = t.id
WHERE o.order_date = target_date
GROUP BY t.name
ORDER BY 6 DESC;
$$ LANGUAGE sql SECURITY DEFINER;
