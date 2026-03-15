-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SalesHub — Supabase Database Schema                       ║
-- ║  วาง SQL นี้ทั้งหมดใน Supabase SQL Editor แล้วกด Run       ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── TABLES ──────────────────────────────────────────

CREATE TABLE teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'employee')),
  team_id UUID REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES profiles(id) NOT NULL,
  team_id UUID REFERENCES teams(id) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_amount NUMERIC(12,2) GENERATED ALWAYS AS (amount * quantity) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orders_employee ON orders(employee_id);
CREATE INDEX idx_orders_team ON orders(team_id);
CREATE INDEX idx_orders_date ON orders(created_at DESC);

-- ── ROW LEVEL SECURITY ─────────────────────────────

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_teams" ON teams FOR SELECT USING (true);
CREATE POLICY "manager_create_team" ON teams FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);

CREATE POLICY "read_profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "create_own_profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "manager_read_orders" ON orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);
CREATE POLICY "employee_read_team_orders" ON orders FOR SELECT USING (
  team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "employee_create_order" ON orders FOR INSERT WITH CHECK (auth.uid() = employee_id);

-- ❌ ไม่มี UPDATE/DELETE policy = ห้ามแก้ไข/ลบออเดอร์

-- ── TRIGGERS ป้องกันแก้ไข/ลบ (ชั้นที่ 2) ────────

CREATE OR REPLACE FUNCTION prevent_order_update() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'ไม่สามารถแก้ไขออเดอร์ได้'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER no_order_update BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION prevent_order_update();

CREATE OR REPLACE FUNCTION prevent_order_delete() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'ไม่สามารถลบออเดอร์ได้'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER no_order_delete BEFORE DELETE ON orders FOR EACH ROW EXECUTE FUNCTION prevent_order_delete();

-- ── REALTIME ────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- ── REPORT FUNCTIONS ────────────────────────────────

CREATE OR REPLACE FUNCTION get_daily_sales(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (team_name TEXT, employee_name TEXT, total_sales NUMERIC, order_count BIGINT) AS $$
SELECT t.name, p.full_name, COALESCE(SUM(o.total_amount),0), COUNT(o.id)
FROM profiles p JOIN teams t ON p.team_id = t.id
LEFT JOIN orders o ON o.employee_id = p.id AND o.created_at::date = target_date
WHERE p.role = 'employee' GROUP BY t.name, p.full_name ORDER BY 3 DESC;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_weekly_sales()
RETURNS TABLE (sale_date DATE, total_sales NUMERIC, order_count BIGINT) AS $$
SELECT o.created_at::date, SUM(o.total_amount), COUNT(o.id) FROM orders o
WHERE o.created_at >= CURRENT_DATE - INTERVAL '7 days' GROUP BY 1 ORDER BY 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_monthly_sales(
  m INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::int,
  y INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int
) RETURNS TABLE (team_name TEXT, total_sales NUMERIC, order_count BIGINT) AS $$
SELECT t.name, COALESCE(SUM(o.total_amount),0), COUNT(o.id) FROM teams t
LEFT JOIN orders o ON o.team_id = t.id
  AND EXTRACT(MONTH FROM o.created_at) = m AND EXTRACT(YEAR FROM o.created_at) = y
GROUP BY t.name ORDER BY 2 DESC;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── ข้อมูลเริ่มต้น ──────────────────────────────────

INSERT INTO teams (name) VALUES ('ทีม Alpha'), ('ทีม Beta'), ('ทีม Gamma');
```
