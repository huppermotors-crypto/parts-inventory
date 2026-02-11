-- ============================================
-- Auto Parts Inventory - Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Parts table
CREATE TABLE parts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Vehicle info (from VIN decode)
  vin VARCHAR(17),
  year INTEGER,
  make VARCHAR(100),
  model VARCHAR(100),

  -- Part info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  serial_number VARCHAR(100),
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  condition VARCHAR(50) NOT NULL DEFAULT 'used',

  -- Photos stored as array of URLs in Supabase Storage
  photos TEXT[] DEFAULT '{}',

  -- Visibility
  is_published BOOLEAN DEFAULT TRUE
);

-- Index for faster search/filter
CREATE INDEX idx_parts_make ON parts (make);
CREATE INDEX idx_parts_model ON parts (model);
CREATE INDEX idx_parts_created_at ON parts (created_at DESC);
CREATE INDEX idx_parts_is_published ON parts (is_published);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_parts_updated_at
  BEFORE UPDATE ON parts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;

-- Public can read published parts
CREATE POLICY "Public can view published parts"
  ON parts FOR SELECT
  USING (is_published = TRUE);

-- Authenticated users can do everything
CREATE POLICY "Authenticated users can insert parts"
  ON parts FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can update parts"
  ON parts FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can delete parts"
  ON parts FOR DELETE
  TO authenticated
  USING (TRUE);

-- Authenticated users can also read all parts (including unpublished)
CREATE POLICY "Authenticated users can view all parts"
  ON parts FOR SELECT
  TO authenticated
  USING (TRUE);

-- ============================================
-- Storage bucket for part photos
-- ============================================
-- Run this in the Supabase Dashboard > Storage:
-- 1. Create a bucket named "part-photos" with public access
-- 2. Or use SQL:

INSERT INTO storage.buckets (id, name, public)
VALUES ('part-photos', 'part-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public can view part photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'part-photos');

CREATE POLICY "Authenticated users can upload part photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'part-photos');

CREATE POLICY "Authenticated users can update part photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'part-photos');

CREATE POLICY "Authenticated users can delete part photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'part-photos');
