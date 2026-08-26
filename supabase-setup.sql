-- ============================================
-- Patel Dental Clinic — Supabase Setup Script
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Create a sequence for generating patient ID numbers
CREATE SEQUENCE IF NOT EXISTS patient_id_seq START 1;

-- 2. Create the patients table
CREATE TABLE IF NOT EXISTS patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id TEXT UNIQUE NOT NULL,
  patient_name TEXT NOT NULL,
  tooth_number TEXT NOT NULL,
  image_url TEXT,
  image_path TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create an index on patient_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients (patient_id);

-- 4. Create an index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients (created_at DESC);

-- 5. Enable Row Level Security
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policy — allow all operations (adjust for production)
--    For a clinic app used internally, this is fine.
--    For production with auth, restrict to authenticated users.
CREATE POLICY "Allow all access to patients"
  ON patients
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. Function to get next patient ID sequence value
CREATE OR REPLACE FUNCTION get_next_patient_seq()
RETURNS INTEGER AS $$
  SELECT nextval('patient_id_seq')::INTEGER;
$$ LANGUAGE SQL;

-- ============================================
-- STORAGE SETUP (do this in Supabase Dashboard)
-- ============================================
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Click "New Bucket"
-- 3. Name it: rvg-images
-- 4. Toggle ON "Public bucket"
-- 5. Click "Create bucket"
--
-- Then add this storage policy (run in SQL Editor):
-- ============================================

-- Allow public read access to rvg-images bucket
CREATE POLICY "Public read access for rvg-images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'rvg-images');

-- Allow public insert access to rvg-images bucket
CREATE POLICY "Public insert access for rvg-images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'rvg-images');

-- Allow public update access to rvg-images bucket
CREATE POLICY "Public update access for rvg-images"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'rvg-images');

-- Allow public delete access to rvg-images bucket
CREATE POLICY "Public delete access for rvg-images"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'rvg-images');
