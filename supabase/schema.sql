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

  -- Inventory
  stock_number VARCHAR(10) UNIQUE,

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
  category VARCHAR(100),

  -- Photos stored as array of URLs in Supabase Storage
  photos TEXT[] DEFAULT '{}',

  -- Visibility
  is_published BOOLEAN DEFAULT TRUE,
  is_sold BOOLEAN DEFAULT FALSE,

  -- Facebook Marketplace
  fb_posted_at TIMESTAMPTZ,

  -- eBay integration
  ebay_listing_id VARCHAR(100),
  ebay_offer_id VARCHAR(100),
  ebay_listing_url TEXT,
  ebay_listed_at TIMESTAMPTZ
);

-- Indexes for faster search/filter
CREATE INDEX idx_parts_make ON parts (make);
CREATE INDEX idx_parts_model ON parts (model);
CREATE INDEX idx_parts_created_at ON parts (created_at DESC);
CREATE INDEX idx_parts_is_published ON parts (is_published);
CREATE INDEX idx_parts_stock_number ON parts (stock_number);
CREATE INDEX idx_parts_category ON parts (category);
CREATE INDEX idx_parts_published_sold ON parts (is_published, is_sold);
CREATE INDEX idx_parts_price ON parts (price);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE TRIGGER update_parts_updated_at
  BEFORE UPDATE ON parts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;

-- Public can read published parts only
CREATE POLICY "Public can view published parts"
  ON parts FOR SELECT
  USING (is_published = TRUE);

-- Admin (specific email) can read all parts including unpublished
CREATE POLICY "Admin can view all parts"
  ON parts FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'nvn9586@gmail.com');

-- Admin can insert parts
CREATE POLICY "Admin can insert parts"
  ON parts FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'nvn9586@gmail.com');

-- Admin can update parts
CREATE POLICY "Admin can update parts"
  ON parts FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'nvn9586@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'nvn9586@gmail.com');

-- Admin can delete parts
CREATE POLICY "Admin can delete parts"
  ON parts FOR DELETE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'nvn9586@gmail.com');

-- ============================================
-- Storage bucket for part photos
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'part-photos',
  'part-photos',
  TRUE,
  5242880, -- 5MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Storage policies
CREATE POLICY "Public can view part photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'part-photos');

CREATE POLICY "Admin can upload part photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'part-photos' AND
    auth.jwt() ->> 'email' = 'nvn9586@gmail.com'
  );

CREATE POLICY "Admin can update part photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'part-photos' AND
    auth.jwt() ->> 'email' = 'nvn9586@gmail.com'
  );

CREATE POLICY "Admin can delete part photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'part-photos' AND
    auth.jwt() ->> 'email' = 'nvn9586@gmail.com'
  );

-- ============================================
-- Analytics: page_views table
-- ============================================
CREATE TABLE page_views (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  page_path VARCHAR(500) NOT NULL,
  page_title VARCHAR(500),
  visitor_hash VARCHAR(64) NOT NULL,
  visitor_id VARCHAR(36),
  ip_address VARCHAR(45),
  referrer VARCHAR(1000),
  device_type VARCHAR(20),
  browser VARCHAR(50),
  os VARCHAR(50),
  country VARCHAR(100),
  country_code CHAR(2),
  city VARCHAR(100),
  region VARCHAR(100)
);

CREATE INDEX idx_pv_created ON page_views (created_at DESC);
CREATE INDEX idx_pv_path ON page_views (page_path);
CREATE INDEX idx_pv_country ON page_views (country_code);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view analytics"
  ON page_views FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'nvn9586@gmail.com');
