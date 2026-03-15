# ⚡ SalesHub

ระบบจัดการยอดขาย Real-time | **GitHub + Supabase เท่านั้น**

---

## สิ่งที่ต้องมี

- [Node.js](https://nodejs.org/) v18+
- [Git](https://git-scm.com/)
- บัญชี [GitHub](https://github.com) (ฟรี)
- บัญชี [Supabase](https://supabase.com) (ฟรี)

---

## วิธีติดตั้ง

### 1. สร้าง GitHub Repo

1. ไปที่ https://github.com/new
2. ตั้งชื่อ `saleshub` → กด **Create repository**
3. ยังไม่ต้องทำอะไร — กลับมาทำข้อ 2 ต่อ

### 2. สร้างโปรเจค Supabase

1. ไปที่ https://supabase.com → **New Project**
2. ตั้งชื่อ `saleshub` → Region: **Singapore** → สร้าง
3. รอ 2 นาที → ไปที่ **Settings → API** → จดค่า:
   - `Project URL` (เช่น https://xxxxx.supabase.co)
   - `anon public key` (เช่น eyJhbGci...)

### 3. สร้าง Database

1. ใน Supabase Dashboard → **SQL Editor** → **New Query**
2. เปิดไฟล์ `supabase-schema.sql` ในโปรเจคนี้
3. Copy ทั้งหมด → วาง → กด **Run**
4. ได้ตาราง teams, profiles, orders + Realtime + RLS ทั้งหมด

### 4. ตั้งค่าในเครื่อง

```bash
unzip saleshub-project.zip
cd saleshub
npm install
cp .env.example .env
```

แก้ไฟล์ `.env` — ใส่ค่าจาก Supabase:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 5. ทดสอบ

```bash
npm run dev
```

เปิด http://localhost:5173 → ลองสมัคร + สร้างออเดอร์

### 6. Push ขึ้น GitHub

```bash
git init
git add .
git commit -m "🚀 SalesHub init"
git remote add origin https://github.com/YOUR_USER/saleshub.git
git push -u origin main
```

### 7. ตั้งค่า GitHub (ทำครั้งเดียว)

**7a. ใส่ Secrets:**

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. กด **New repository secret** สร้าง 2 ตัว:
   - Name: `VITE_SUPABASE_URL` → Value: URL ของ Supabase
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: anon key ของ Supabase

**7b. เปิด GitHub Pages:**

1. GitHub repo → **Settings** → **Pages**
2. Source: เลือก **GitHub Actions**

### 8. รอ Deploy

1. tab **Actions** → workflow "Deploy to GitHub Pages" กำลังทำงาน
2. รอ 1-2 นาที → เสร็จ
3. URL: `https://YOUR_USER.github.io/saleshub/`

---

## ใช้งานบนมือถือ

1. เปิด URL ใน Chrome/Safari
2. Android: กด ⋮ → Add to Home Screen
3. iPhone: กด Share → Add to Home Screen

---

## อัพเดทครั้งต่อไป

```bash
git add .
git commit -m "อัพเดท"
git push
```

GitHub Actions จะ build + deploy ให้อัตโนมัติ!
