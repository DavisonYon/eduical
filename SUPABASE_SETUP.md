# Supabase Setup Guide

This guide will help you set up Supabase for authentication in your Educial application.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in to your account
3. Click "New Project"
4. Fill in your project details:
   - **Name**: Educial (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the closest region to your users
5. Click "Create new project" and wait for it to be set up (takes ~2 minutes)

## Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. You'll find:
   - **Project URL**: Copy this value
   - **anon/public key**: Copy this value (this is safe to expose in frontend)
3. These are the values you'll need for your `.env` file

## Step 3: Configure Environment Variables

1. Create a `.env` file in the root of your project (same level as `package.json`)
2. Copy the contents from `.env.example` and fill in your values:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important**: 
- Never commit your `.env` file to version control
- The `.env` file is already in `.gitignore` (should be)
- The `anon` key is safe to use in frontend code (it's public)

## Step 4: Configure Authentication Settings

1. In Supabase dashboard, go to **Authentication** → **Settings**
2. Configure the following:

### Site URL
- Set to: `http://localhost:5173` (for development)
- For production, set to your production URL

### Redirect URLs
Add these URLs (one per line):
```
http://localhost:5173/**
http://localhost:5173/login
http://localhost:5173/register
```

For production, add your production URLs as well.

### Email Templates (Optional)
You can customize the email templates under **Authentication** → **Email Templates**:
- Confirm signup
- Reset password
- Magic link

## Step 5: Database Setup

Supabase automatically creates the `auth.users` table for authentication. However, if you want to store additional user profile information, you can create a `profiles` table.

### Create Profiles Table (Optional)

Run this SQL in the Supabase SQL Editor (**SQL Editor** → **New Query**):

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

-- Create policy to allow users to read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Create policy to allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Create policy to allow users to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create a function to automatically create a profile when a user signs up
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

-- Create a trigger to call the function when a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Step 6: Security Best Practices

### Row Level Security (RLS)
- All tables should have RLS enabled
- Create policies that restrict access based on `auth.uid()`
- Never disable RLS in production

### API Keys
- **Anon Key**: Safe to use in frontend (has RLS protection)
- **Service Role Key**: NEVER expose in frontend (only use in backend/server)
- Keep your service role key secret and secure

### Environment Variables
- Use `.env` for local development
- Use environment variables in your hosting platform for production
- Never commit `.env` files to git

## Step 7: Test Your Setup

1. Start your development server: `npm run dev`
2. Navigate to `http://localhost:5173/register`
3. Create a test account
4. Check your email for the confirmation link (if email confirmation is enabled)
5. Log in with your credentials

## Troubleshooting

### "Missing Supabase environment variables" error
- Make sure your `.env` file exists in the project root
- Check that variable names start with `VITE_`
- Restart your dev server after creating/updating `.env`

### Authentication not working
- Check that your Site URL and Redirect URLs are configured correctly
- Verify your API keys are correct
- Check the browser console for errors

### Email confirmation not working
- Check your email spam folder
- Verify email settings in Supabase dashboard
- You can disable email confirmation in **Authentication** → **Settings** → **Email Auth** (for development only)

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
