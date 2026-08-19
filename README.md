# W.L.R Command Personnel System

Frontend แบบ static สำหรับ GitHub Pages เชื่อม Supabase (Auth, PostgreSQL, Storage) และเปิด REST API ให้ Roblox HttpService

## ทดสอบในเครื่อง (Local test)

ไม่ต้องเปิดไฟล์ HTML ตรงๆ เพราะ ES modules จะไม่ทำงาน ให้เปิดผ่านเซิร์ฟเวอร์ในเครื่อง

1. ดับเบิลคลิก `start-local.cmd` หรือรันใน PowerShell:

```powershell
.\start-local.cmd
```

เบราว์เซอร์จะเปิด `http://127.0.0.1:4173/login.html` ให้เอง ไม่ต้องติดตั้ง Node.js

ถ้ามี Node.js อยู่แล้ว จะใช้ `npm start` ก็ได้

2. ใช้บัญชีทดสอบด้านล่าง หรือกดปุ่มบนหน้า Login

ถ้ายังไม่ได้ใส่ค่า Supabase ใน `js/config.js` ระบบจะเข้า **Local test mode** อัตโนมัติ ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น

บัญชีทดสอบ:

- Admin: `admin@local.test` / `admin`
- Officer: `officer@local.test` / `officer`

หน้า Login มีปุ่มกรอกบัญชีและปุ่ม Reset local test data

เมื่อใส่ `supabaseUrl` และ `supabaseAnonKey` จริงใน `js/config.js` ระบบจะเชื่อม Supabase แทนโหมดทดสอบ

## 1. ไฟล์ตราสัญลักษณ์

วางไฟล์โลโก้แคลนที่ `assets/1.jpg`

## 2. ตั้งค่า Supabase

1. สร้างโปรเจกต์ใน Supabase Dashboard
2. เปิด SQL Editor แล้วรันตามลำดับ:
   - `sql/001_oc_personnel_schema.sql`
   - `sql/002_oc_avatars_storage.sql`
   - `sql/003_oc_roblox_roster.sql`
   - `sql/005_user_settings_and_logs.sql`
   - `sql/006_announcements.sql`
   - `sql/007_announcement_covers.sql`
   - `sql/008_service_records.sql`
   - `sql/009_lore_documents.sql`
3. เมื่อบัญชีผู้ดูแลระบบสมัครแล้ว แก้อีเมลใน `sql/004_bootstrap_admin.sql` แล้วรัน

## 3. ตั้งค่า Frontend

แก้ `js/config.js`

- `supabaseUrl` : Project URL
- `supabaseAnonKey` : anon / publishable key

ห้ามใส่ service_role key ในไฟล์ฝั่งเว็บ

## 4. Authentication

ในหน้า Authentication:

- เปิด Email / Password
- ใส่ URL ของ GitHub Pages ใน Site URL และ Redirect URLs

บัญชีใหม่ถูกสร้างใน `oc_personnel` โดย `role = user` และ `military_rank = Lieutenant`

## 5. GitHub Pages

Publish ที่ root ของ repository โดย `index.html` คือหน้า Home

## 6. Roblox

ใช้ไฟล์ `roblox/HttpServiceRoster.lua`

ตัวอย่าง:

`GET {SUPABASE_URL}/rest/v1/oc_roblox_roster?select=id,name,rank,branch,avatar_url&order=sort_order.asc`

Header:

- `apikey: {ANON_KEY}`
- `Authorization: Bearer {ANON_KEY}`

ฟิลด์ที่ส่งกลับ: `id`, `name`, `rank`, `branch`, `avatar_url`
