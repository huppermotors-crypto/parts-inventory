-- Create expenses table for financial tracking
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_interval TEXT
);

-- RLS: only admin
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON expenses
  FOR ALL USING (auth.email() = 'nvn9586@gmail.com');
