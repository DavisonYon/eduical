# Quick Start Guide - Authentication Setup

## 1. Create Your .env File

Create a `.env` file in the root directory with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these values:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **Project URL** and **anon/public key**

## 2. Supabase Configuration

### Authentication Settings
1. In Supabase Dashboard → **Authentication** → **Settings**
2. Set **Site URL** to: `http://localhost:5173`
3. Add **Redirect URLs**:
   ```
   http://localhost:5173/**
   http://localhost:5173/login
   http://localhost:5173/register
   ```

### Database Setup (Optional - for user profiles)

Run this SQL in Supabase SQL Editor:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Users can insert own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## 3. Start the Application

```bash
npm run dev
```

Navigate to `http://localhost:5173` and you'll be redirected to login.

## 4. Test Authentication

1. Go to `/register` to create an account
2. Check your email for confirmation (if enabled)
3. Log in at `/login`
4. You'll be redirected to the dashboard after successful login

## Security Notes

✅ **Safe to expose in frontend:**
- `VITE_SUPABASE_ANON_KEY` - Protected by Row Level Security (RLS)

❌ **Never expose:**
- Service Role Key (only use in backend/server)
- Database passwords

## Files Created

- `src/lib/supabase.ts` - Supabase client configuration
- `src/contexts/AuthContext.tsx` - Authentication context provider
- `src/pages/Login.tsx` - Login page
- `src/pages/Register.tsx` - Registration page
- `src/components/ProtectedRoute.tsx` - Route protection component
- `src/pages/Dashboard.tsx` - Protected dashboard page

For detailed setup instructions, see `SUPABASE_SETUP.md`
