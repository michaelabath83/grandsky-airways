-- Auto-create profile when user signs up
-- Also enable RLS policies for profile creation and updates

-- Enable RLS on profiles if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can read their own profile" 
  ON profiles FOR SELECT USING (auth.uid()::text = id);

-- Policy: Users can insert their own profile (needed for signup)
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid()::text = id) WITH CHECK (auth.uid()::text = id);

-- Policy: Service role can do anything (for admin operations)
CREATE POLICY "Service role can manage all profiles"
  ON profiles FOR ALL USING (auth.role() = 'service_role');

-- Function to handle new user signup: create basic profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
