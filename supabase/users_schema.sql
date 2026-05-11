-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'user');

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
-- 1. Users can view their own profile
CREATE POLICY "Users can view own profile" 
    ON public.user_profiles 
    FOR SELECT 
    USING (auth.uid() = id);

-- 2. Superadmins and admins can view all profiles
CREATE POLICY "Admins can view all profiles" 
    ON public.user_profiles 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
        )
    );

-- 3. Only superadmins can update roles
CREATE POLICY "Superadmins can update profiles" 
    ON public.user_profiles 
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    is_superadmin BOOLEAN;
BEGIN
    -- Check if domain is arthromed.com.mx
    IF NEW.email NOT LIKE '%@arthromed.com.mx' THEN
        RAISE EXCEPTION 'Only @arthromed.com.mx emails are allowed';
    END IF;

    -- Determine if superadmin (eduardo@arthromed.com.mx or admin@arthromed.com.mx)
    is_superadmin := NEW.email IN ('eduardo@arthromed.com.mx', 'admin@arthromed.com.mx');

    INSERT INTO public.user_profiles (id, email, role)
    VALUES (
        NEW.id, 
        NEW.email, 
        CASE WHEN is_superadmin THEN 'superadmin'::user_role ELSE 'user'::user_role END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = user_id AND role IN ('superadmin', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
