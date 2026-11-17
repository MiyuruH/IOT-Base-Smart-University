-- =========================
-- USERS
-- =========================
CREATE TABLE users (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- FIXED: Added missing password_hash column
  role TEXT CHECK (role IN ('ADMIN','SUPER_ADMIN')) DEFAULT 'ADMIN',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(), -- IMPROVED: Used TIMESTAMPTZ for proper Supabase timezone handling
  created_by UUID REFERENCES users(uid),
  last_login_at TIMESTAMPTZ
);

-- =========================
-- BUILDINGS
-- =========================
CREATE TABLE buildings (
  building_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  address TEXT,
  created_by UUID REFERENCES users(uid),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- FLOORS
-- =========================
CREATE TABLE floors (
  floor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(building_id) ON DELETE CASCADE,
  level INT,
  name TEXT,
  map_image_url TEXT,
  px_per_meter FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- ROOMS
-- =========================
CREATE TABLE rooms (
  room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(building_id) ON DELETE CASCADE,
  floor_id UUID REFERENCES floors(floor_id) ON DELETE CASCADE,
  name TEXT,
  code TEXT,
  type TEXT CHECK (type IN ('HALL','LAB','OFFICE')),
  is_public_destination BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- BEACONS
-- =========================
CREATE TABLE beacons (
  beacon_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid TEXT,
  major INT,
  minor INT,
  mac TEXT,
  building_id UUID REFERENCES buildings(building_id) ON DELETE CASCADE,
  floor_id UUID REFERENCES floors(floor_id) ON DELETE CASCADE,
  mapped_room_id UUID REFERENCES rooms(room_id) ON DELETE SET NULL,
  tx_power INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- NAVIGATION GRAPHS
-- =========================
CREATE TABLE navigation_graphs (
  graph_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(building_id) ON DELETE CASCADE,
  floor_id UUID REFERENCES floors(floor_id) ON DELETE CASCADE,
  version INT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- SENSOR NODES
-- =========================
CREATE TABLE sensor_nodes (
  node_id TEXT PRIMARY KEY,
  room_id UUID REFERENCES rooms(room_id) ON DELETE CASCADE,
  device_name TEXT,
  firmware_version TEXT,
  wifi_mac TEXT,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- READINGS (REALTIME CORE)
-- =========================
CREATE TABLE readings (
  reading_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id TEXT REFERENCES sensor_nodes(node_id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(room_id) ON DELETE CASCADE,
  noise_db FLOAT,
  pir_motion BOOLEAN,
  temperature_c FLOAT,
  light_lux FLOAT,
  occupancy_detected BOOLEAN,
  ghost_cooling_suspected BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- ROOM STATUS (SNAPSHOT)
-- =========================
CREATE TABLE room_status (
  room_id UUID PRIMARY KEY REFERENCES rooms(room_id) ON DELETE CASCADE,
  occupancy TEXT CHECK (occupancy IN ('OCCUPIED','EMPTY')),
  temperature_c FLOAT,
  light_lux FLOAT,
  noise_db FLOAT,
  ghost_cooling_active BOOLEAN,
  ghost_cooling_level TEXT CHECK (ghost_cooling_level IN ('LOW','MEDIUM','HIGH')),
  ghost_cooling_reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_reading_id UUID REFERENCES readings(reading_id) ON DELETE SET NULL
);

-- =========================
-- ANOMALIES
-- =========================
CREATE TABLE anomalies (
  anomaly_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('GHOST_COOLING','SENSOR_OFFLINE','HIGH_TEMP','HIGH_NOISE','HIGH_HUMIDITY')),
  room_id UUID REFERENCES rooms(room_id) ON DELETE CASCADE,
  node_id TEXT REFERENCES sensor_nodes(node_id) ON DELETE CASCADE,
  severity TEXT CHECK (severity IN ('LOW','MEDIUM','HIGH')),
  message TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- =========================
-- INDEXES (PERFORMANCE)
-- =========================
CREATE INDEX idx_readings_room ON readings(room_id);
CREATE INDEX idx_readings_node ON readings(node_id);
CREATE INDEX idx_readings_created ON readings(created_at DESC);
CREATE INDEX idx_room_status_updated ON room_status(updated_at DESC);
CREATE INDEX idx_anomalies_active ON anomalies(is_active);


-- =========================
-- Row Level Security (RLS)
-- =========================

-- Enable Row Level Security (RLS) on all tables to lock them down.
-- Since your Next.js project uses the SUPABASE_SERVICE_ROLE_KEY on the backend, 
-- it will automatically bypass these restrictions. 
-- However, enabling this prevents anyone on the public internet from 
-- reading/writing data using your 'anon' key!

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE beacons ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;

-- If you DO want the frontend (React/Next.js client) to read certain tables directly, 
-- you would add a policy like this to only allow reading:
-- CREATE POLICY "Allow public read-only access to buildings" ON buildings FOR SELECT USING (true);

-- ========================================
-- Buildings <- Floors & Rooms 
-- ========================================

-- =========================
-- 1. CREATE FLOORS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS floors (
  floor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(building_id) ON DELETE CASCADE,
  level INT,
  name TEXT,
  map_image_url TEXT,
  px_per_meter FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- 2. CREATE ROOMS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS rooms (
  room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(building_id) ON DELETE CASCADE,
  floor_id UUID REFERENCES floors(floor_id) ON DELETE CASCADE,
  name TEXT,
  code TEXT,
  type TEXT CHECK (type IN ('HALL','LAB','OFFICE')),
  is_public_destination BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ===================================
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 4. ADD NEW COLUMNS TO BUILDINGS TABLE
-- ========================================
-- (Running this again is safe. It will add them if they don't exist yet)
ALTER TABLE public.buildings
ADD COLUMN IF NOT EXISTS number_of_floors INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS number_of_rooms INT DEFAULT 0;








create table sensor_readings (
  id bigint generated by default as identity primary key,
  room_id uuid references rooms(room_id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  temp numeric,
  humidity numeric,
  noise_level numeric,
  is_occupied boolean,
  light_status boolean
);

-- Turn on Realtime for sensor_readings and anomalies tables
alter publication supabase_realtime add table sensor_readings;
alter publication supabase_realtime add table anomalies;



-- Allow anyone to read the sensor data
CREATE POLICY "Allow public read access to sensor readings" 
ON sensor_readings FOR SELECT USING (true);

-- (Optional) Make sure RLS is actually enabled
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;

-- =========================
-- ALERT & NOTIFICATION SETTINGS
-- =========================
CREATE TABLE IF NOT EXISTS alert_settings (
  setting_key TEXT PRIMARY KEY DEFAULT 'global',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE alert_settings ENABLE ROW LEVEL SECURITY;


