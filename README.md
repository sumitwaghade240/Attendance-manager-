# AttendEase — Cloud College Attendance Management System

**AttendEase** is a modern, enterprise-grade cloud college attendance management system built with **PostgreSQL**, **Supabase Authentication**, and **Database-Level Row Level Security (RLS)**. It enforces strict department and class data isolation across **Super Admins**, **Faculty / Teachers**, **Students**, and **Class Monitors**, and provides cross-platform support for **Web (PWA)**, **Desktop (Electron for Windows)**, and **Mobile (Android via Capacitor)**.

---

## 🚀 Key Production Upgrades (v2.0.0)

- 🔒 **Database-Level Row Level Security (RLS)**
  - Hardened PostgreSQL RLS policies and security-definer helper functions.
  - **Strict Department & Class Isolation**: A Teacher from Department A (e.g., BCA) can **never** access Department B (e.g., CSE) students, classes, or attendance records, even if frontend requests or query parameters are tampered with.
  - **Student Self-Data Isolation**: Students can strictly only view their own profile, personal attendance rate, and subject-wise logs.
- 🔐 **Real Supabase Cloud Authentication**
  - Email & password authentication with secure JWT sessions.
  - Integrated **Password Recovery / Forgot Password** workflow with token dispatch.
  - Role-based routing verified strictly against the server's database profile (no trusting client role selectors).
- 👨‍🏫 **Faculty & Teacher Portal**
  - Assigned class & subject lecture attendance recording.
  - **Attendance Safety Verification**: Real-time pre-submission verification showing total roster, present count, absent count, and attendance percentage.
  - **Accidental Duplicate Prevention**: Checks unique lecture session slots `(class_id, date, start_time, subject_name)`.
  - **Critical Absentee Alerts**: Identifies students absent for $\ge 2$ consecutive lecture days with instant direct Call (`tel:`) and WhatsApp messaging links.
  - **Attendance Database & CSV Export**: Department-isolated historical logs inspection and sanitised CSV database exports.
  - **Student Roster Management**: Add, update, and manage student directories.
- 👨‍🎓 **Dedicated Student Portal**
  - Real-time overall attendance percentage calculation: $\frac{\text{Present Sessions}}{\text{Total Sessions}} \times 100$.
  - **Subject-Wise Breakdown**: Visual progress bars color-coded for examination eligibility ($>75\%$ Green, $60-75\%$ Amber, $<60\%$ Red).
  - Personal chronological attendance history logs.
  - Student security & self-service password update.
- 🏛️ **Institutional Super Admin Console**
  - College-wide overview metrics (Departments, Classes, Teachers, Students).
  - Department management (Add/Configure programs: BCA, CSE, BBA, ECE, MCA, MBA, Fashion Design, etc.).
  - Academic class registry and teacher assignments.
  - Live security audit logs trail.
- 📱 **Cross-Platform Compatibility**
  - Progressive Web App (PWA) with Service Worker caching.
  - Native Windows Desktop App with Electron (`electron-main.js`).
  - Native Android Mobile App configured via Capacitor.

---

## 🔑 Demonstration Test Accounts

For testing and demonstration, use the following pre-seeded test accounts:

| Portal Role | Email / Username | Password | Assigned Access Level |
| :--- | :--- | :--- | :--- |
| **🏛️ Super Admin** | `admin@demo.attendease.local` | `password` | Global institutional access across all departments |
| **🎓 BCA Teacher** | `teacher.bca@demo.attendease.local` | `password` | Isolated strictly to BCA department & BCA classes |
| **🎓 CSE Teacher** | `teacher.cse@demo.attendease.local` | `password` | Isolated strictly to CSE department & CSE classes |
| **👨‍🎓 BCA Student** | `student.bca@demo.attendease.local` | `password` | Isolated strictly to personal BCA student attendance |
| **👨‍🎓 CSE Student** | `student.cse@demo.attendease.local` | `password` | Isolated strictly to personal CSE student attendance |
| **📋 Class Monitor** | `monitor.cse@demo.attendease.local` | `password` | Assigned class roster attendance logging |

*(Note: In production environments, credentials are managed via Supabase Auth with custom user invitations and email verification).*

---

## 🛡️ Database Architecture & Row Level Security (RLS)

### Entity Relational Schema
```
departments (id, name, code, description, program_type, status)
profiles (id, auth_user_id, full_name, email, phone, role, department_id, status)
academic_classes (id, department_id, name, year, semester, section, academic_year, status)
teacher_assignments (id, teacher_id, department_id, class_id)
students (id, auth_user_id, student_id, full_name, email, phone, whatsapp, department_id, class_id, alerts_enabled, status)
subjects (id, name, code, department_id)
attendance_sessions (id, class_id, subject_id, subject_name, teacher_id, date, start_time, end_time, topic, submitted_by_name)
attendance_records (id, session_id, student_id, status, marked_at, marked_by)
audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
```

### Security Definer Helper Functions
- `get_current_profile_id()`: Returns current user's profile UUID.
- `get_current_user_role()`: Returns authenticated role (`super_admin`, `teacher`, `student`, `monitor`).
- `get_teacher_department_ids()`: Returns UUIDs of departments assigned to teacher.
- `get_teacher_class_ids()`: Returns UUIDs of classes assigned to teacher.
- `get_student_own_id()`: Returns authenticated student's own record UUID.

---

## ⚙️ Setup & Supabase Configuration

### 1. Configure Supabase Project
1. Create a project at [supabase.com](https://supabase.com).
2. Navigate to **SQL Editor** and run the migration script:
   - File: `supabase/migrations/20260827_init_attendease_schema.sql`
3. Seed test data and demo accounts by running:
   - File: `supabase/seed.sql`
4. Copy your **Project URL** and **Anon Public Key** from Supabase Settings $\rightarrow$ API.
5. Create `.env` from `.env.example`:
   ```bash
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-public-key
   ```

---

## 🏃 Running the Application

### 1. Web Mode (Local Browser)
Serve the static web distribution folder:
```bash
npx serve www
```
Open `http://localhost:3000` (or `http://localhost:8080`) in your web browser.

### 2. Desktop Mode (Electron for Windows)
To launch the native Windows desktop app:
```bash
npm run electron:start
```
To package standalone Windows installer/portable executable:
```bash
npm run electron:build
```

### 3. Automated Security & Data Isolation Tests
Run the automated security test suite verifying RLS isolation across Teachers, Students, and Super Admins:
```bash
node www/test_attendease_security.js
```

---

## 📄 License
This project is licensed under the ISC License.
