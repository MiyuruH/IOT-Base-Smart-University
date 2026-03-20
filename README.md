# NavSense — Smart Building Management System

A production-ready, full-stack IoT Smart University management dashboard built natively with Next.js 16 (App Router), React 19, TypeScript, Advanced Custom CSS, and Supabase. 

## 🚀 Features

- **Real-Time IoT Monitoring** — Live sensor data (temperature, sound, light, motion) streaming directly from edge functions.
- **Smart Occupancy Tracking** — Room-level occupancy tracking with trends and historical analytics.
- **Environmental Analytics** — Deep insights into building environments affecting comfort and power usage.
- **Automated Alerting** — Configurable system anomalies (Ghost Cooling, Extreme Temps) with severity-based notifications.
- **Multi-Building Management** — Complete CRUD operations to scale across complex university campuses.
- **Role-Based Access Control** — Built-in Super Admin and Admin role infrastructure with stateless JWT protection.
- **Report Generation** — Comprehensive, downloadable timeline metrics.
- **Striking UI/UX Design** — Custom glassmorphism components, 3D CSS flip animations, and glowing interactive hover states.

## 🛠️ Tech Stack

Because this project is exceptionally customized for high performance, it utilizes modern web standards:

| Technology | Purpose |
|---|---|
| Next.js (App Router) | Full-stack React framework (Frontend + APIs) |
| React 19 + TypeScript | UI Library and strict type-safety |
| Standard CSS (Globals) | 3D animations, gradients, and glassmorphism (No Tailwind dependencies needed) |
| Supabase | PostgreSQL Database, Edge Functions, Realtime APIs |
| Bcryptjs + JWT | Custom highly-secure stateless authentication |
| Recharts | Dynamic sensor data visualizations |
| Deno | Serverless Edge Function IoT Simulator execution |

## 🛠️ Technologies Used

### Frontend
- **Next.js 16 (App Router)**: React framework for building server-rendered and statically generated applications.
- **React 19**: Modern UI library for composable components.
- **Tailwind CSS**: Utility-first CSS framework for rapid UI styling.
- **Lucide React / Recharts**: Beautiful icons and dynamic data visualizations.

### Backend & Database
- **Supabase**: Open-source Firebase alternative serving as the Postgres database, Auth provider, and real-time subscription engine.
- **Next.js API Routes**: Serverless functions acting as the intermediate backend layer.
- **Deno Edge Functions**: Used natively in Supabase to run serverless micro-scripts (e.g., simulating sensor data inputs).

### Authentication & Security
- **JWT (JSON Web Tokens)** & **Bcrypt.js**: Custom implementation of stateless tokens and password hashing for user management.

---

## 📂 File Structure

The project relies on a modular separation of concerns following standard Next.js conventions:

```text
📦 IOT-Base-Smart-University
 ┣ 📂 public/              # Static assets (images, fonts)
 ┣ 📂 src/
 ┃ ┣ 📂 app/               # Next.js App Router (Pages & Layouts)
 ┃ ┃ ┣ 📂 (dashboard)/     # Main authenticated app interface routes
 ┃ ┃ ┣ 📂 api/             # Next.js API Routes (Backend layer)
 ┃ ┃ ┣ 📂 login/           # Authentication page
 ┃ ┃ ┣ 📜 layout.tsx       # Root layout file
 ┃ ┃ ┗ 📜 page.tsx         # Landing entry point
 ┃ ┣ 📂 components/        # Reusable React components (UI elements, charts)
 ┃ ┣ 📂 hooks/             # Custom React hooks
 ┃ ┗ 📂 lib/               # Utility functions and services
 ┃   ┗ 📂 services/        # Supabase DB wrapper logic (users, rooms, sensors)
 ┣ 📂 supabase/            # Supabase Configurations
 ┃ ┗ 📂 functions/         # Deno Edge Functions (e.g., IoT data simulator)
 ┣ 📜 .env.local           # Environment variables (Ignored by Git)
 ┣ 📜 package.json         # Project dependencies and scripts
 ┗ 📜 tailwind.config.ts   # Tailwind CSS configuration rules
```

---

## 🗄️ Database Structure

The project uses a relational **PostgreSQL** database managed by Supabase. Here are the core tables and their purpose:

1. **`users`**: Securely holds administrator/staff credentials and roles.
2. **`buildings`**: Represents physical campus structures.
3. **`rooms`**: Specific rooms within the buildings.
4. **`room_status`**: Live availability or tracking status of a room (e.g., reserved, free).
5. **`sensor_nodes`**: Physical hardware devices (ESP32/Raspberry Pi) installed in the campus. Acts as the source of live metrics.
6. **`readings`**: Time-series log of all data emitted by sensors (Temp, Lux, Noise DB, Motion).
7. **`anomalies`**: System-generated alerts indicating unusual parameters (e.g., HVAC cooling an empty room).

---

## ⚙️ Backend Architecture

The backend operates on a 3-tier architecture:
1. **Client API Calls**: Frontend components query `src/app/api/` via HTTP requests.
2. **Next.js Route Handlers**: Files inside `src/app/api/.../route.ts` authorize requests via JWT, process logic, and communicate with the Supabase Database using the `@supabase/supabase-js` client wrapper in `src/lib/services`.
3. **Supabase Database & Real-Time**: Safely handles the transactions and emits changes to subscribed clients if needed. 
*(Sensor data flows directly into Supabase via edge functions or external hardware hooks).*

---

## 📦 Setup

### 1. Install dependencies
Ensure you are using Node.js v18+.
```bash
npm install
```

### 2. Configure Environment
Create a `.env.local` file in your root folder and add your specific Supabase parameters:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-never-share-this
JWT_SECRET=super_secret_navsense_smart_university_key_2026_xyz
```

### 3. Initialize the Database Schema
A highly-optimized database setup file has mapped all relationships correctly.
1. Open your Supabase Dashboard -> SQL Editor.
2. Copy all code from `supabase/schema.sql` and run it.
3. Once successful, copy and run `supabase/rls_security.sql` to lock your tables securely from the public internet.

### 4. Start Development Server
```bash
npm run dev
```

### 5. Automatically Create Demo Users
Because the system employs strict Bcrypt hashing, the best way to create a user is through the live API. Open a new terminal and run these commands to create your Admin accounts:

**Mac/Linux (cURL):**
```bash
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"super@navsense.io\",\"password\":\"SuperAdmin123!\",\"name\":\"Super Admin\",\"role\":\"SUPER_ADMIN\"}"

curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"admin@navsense.io\",\"password\":\"Admin1234!\",\"name\":\"Admin\",\"role\":\"ADMIN\"}"
```

**Windows (PowerShell):**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method Post -ContentType "application/json" -Body '{"email":"super@navsense.io","password":"SuperAdmin123!","name":"Super Admin","role":"SUPER_ADMIN"}'

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method Post -ContentType "application/json" -Body '{"email":"admin@navsense.io","password":"Admin1234!","name":"Admin","role":"ADMIN"}'
```

## 🔐 Demo Credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | super@navsense.io | SuperAdmin123! |
| Admin | admin@navsense.io | Admin1234! |

## 📄 Pages (App Router Routes)

| Page | Route | Description |
|---|---|---|
| Login | `/login` | High-fidelity 3D Flip Card Authentication Interface |
| Dashboard | `/dashboard` | System overview, ambient KPIs, fast metrics |
| Buildings | `/buildings` | Building and infrastructure structural CRUD |
| Rooms | `/rooms` | Precise room definitions and node mapping |
| Alerts | `/alerts` | Severity-based historical anomaly investigation |
| Analytics | `/analytics` | Interactive charts, sensor trends and histories |
| Reports | `/reports` | Data generation and exportation tools |
| Settings | `/settings` | Global system configurations and profile bounds |

*(Note: Authenticated routes are securely wrapped by a layout-level server session verifier).*

## 🎨 Color Palette

We utilize a bespoke dark-themed CSS variable structure for extreme consistency:

| Token (CSS Var) | Hex | Usage |
|---|---|---|
| `--bg-primary` | `#0a0e1a` | Absolute darkest — App layout base, pure backgrounds |
| `--bg-secondary` | `#111827` | Mid-dark — Sidebar, isolated navigation menus |
| `--bg-card` | `#1a1f2e` | Interactive — Dash cards, tables, frosted glassmorphism |
| `--accent-blue` | `#3b82f6` | High contrast — Primary buttons, gradients, glowing borders |
| `--accent-cyan` | `#06b6d4` | Highlight contrast — Secondary gradients, micro-animations |
| `--text-primary` | `#f1f5f9` | White offset — Primary readable typography |
| `--text-muted` | `#64748b` | Greyscale — Data-labels, empty states, system text |
