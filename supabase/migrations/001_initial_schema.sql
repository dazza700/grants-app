-- Government Grants Notification App - Initial Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUM TYPES
-- =============================================

CREATE TYPE organization_type AS ENUM ('individual', 'small_business', 'nonprofit');
CREATE TYPE business_size AS ENUM ('solo', '1-10', '11-50', '51-250', '250+');
CREATE TYPE email_frequency AS ENUM ('immediate', 'daily', 'weekly');
CREATE TYPE grant_source AS ENUM ('grants_gov', 'sam_gov', 'state', 'foundation');
CREATE TYPE application_status AS ENUM ('interested', 'applied', 'awarded', 'rejected');

-- =============================================
-- USER TABLES
-- =============================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  organization_name TEXT,
  organization_type organization_type NOT NULL DEFAULT 'individual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User eligibility criteria
CREATE TABLE public.user_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Location criteria
  location_state TEXT,
  location_city TEXT,

  -- Business/Organization criteria
  industry_categories TEXT[] DEFAULT '{}',
  business_size business_size,
  annual_revenue_min DECIMAL(12, 2),
  annual_revenue_max DECIMAL(12, 2),
  years_in_business INTEGER,

  -- Nonprofit specific
  tax_exempt_status BOOLEAN DEFAULT FALSE,
  nonprofit_category TEXT,

  -- Personal demographic (for individuals)
  veteran_status BOOLEAN DEFAULT FALSE,
  disability_status BOOLEAN DEFAULT FALSE,
  minority_owned BOOLEAN DEFAULT FALSE,
  women_owned BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Notification preferences
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  email_frequency email_frequency DEFAULT 'daily',
  max_daily_emails INTEGER DEFAULT 10,
  categories_filter TEXT[] DEFAULT '{}',
  min_grant_amount DECIMAL(12, 2) DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id)
);

-- =============================================
-- GRANT TABLES
-- =============================================

-- Grants table
CREATE TABLE public.grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic info
  title TEXT NOT NULL,
  description TEXT,
  source_id TEXT NOT NULL,
  source grant_source DEFAULT 'grants_gov',

  -- Financial details
  amount_min DECIMAL(12, 2),
  amount_max DECIMAL(12, 2),
  funding_available DECIMAL(12, 2),

  -- Eligibility
  eligible_organization_types TEXT[] DEFAULT '{}',
  eligible_states TEXT[] DEFAULT '{}',
  industry_categories TEXT[] DEFAULT '{}',

  -- Important dates
  posted_date TIMESTAMP WITH TIME ZONE,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  award_start_date TIMESTAMP WITH TIME ZONE,
  expected_award_date TIMESTAMP WITH TIME ZONE,

  -- Agency info
  agency_name TEXT,
  agency_code TEXT,
  contact_email TEXT,

  -- Metadata
  url TEXT,
  cfda_number TEXT,
  competition_id TEXT,
  raw_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_from_external TIMESTAMP WITH TIME ZONE,

  UNIQUE(source_id, source)
);

-- =============================================
-- NOTIFICATION TABLES
-- =============================================

-- Notification history (tracks which grants were sent to which users)
CREATE TABLE public.notification_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,

  match_score DECIMAL(5, 2),
  notified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_bounced BOOLEAN DEFAULT FALSE,

  UNIQUE(user_id, grant_id)
);

-- =============================================
-- USER ENGAGEMENT TABLES
-- =============================================

-- Saved grants
CREATE TABLE public.saved_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,

  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,

  UNIQUE(user_id, grant_id)
);

-- Grant applications (tracking user's application status)
CREATE TABLE public.grant_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,

  status application_status DEFAULT 'interested',
  applied_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, grant_id)
);

-- =============================================
-- INDEXES
-- =============================================

-- Grant indexes for common queries
CREATE INDEX grants_deadline_idx ON public.grants(deadline);
CREATE INDEX grants_posted_date_idx ON public.grants(posted_date DESC);
CREATE INDEX grants_source_idx ON public.grants(source_id);
CREATE INDEX grants_amount_idx ON public.grants(amount_min, amount_max);
CREATE INDEX grants_org_types_idx ON public.grants USING GIN(eligible_organization_types);
CREATE INDEX grants_states_idx ON public.grants USING GIN(eligible_states);
CREATE INDEX grants_industries_idx ON public.grants USING GIN(industry_categories);

-- User indexes
CREATE INDEX user_criteria_user_id_idx ON public.user_criteria(user_id);
CREATE INDEX notification_prefs_user_id_idx ON public.notification_preferences(user_id);

-- Notification indexes
CREATE INDEX notification_history_user_idx ON public.notification_history(user_id);
CREATE INDEX notification_history_grant_idx ON public.notification_history(grant_id);
CREATE INDEX notification_history_pending_idx ON public.notification_history(email_sent, notified_at);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_applications ENABLE ROW LEVEL SECURITY;

-- User profiles: users can only access their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User criteria: users can only access their own criteria
CREATE POLICY "Users can view own criteria"
  ON public.user_criteria FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own criteria"
  ON public.user_criteria FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own criteria"
  ON public.user_criteria FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own criteria"
  ON public.user_criteria FOR DELETE
  USING (auth.uid() = user_id);

-- Notification preferences: users can only access their own
CREATE POLICY "Users can view own notification prefs"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification prefs"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification prefs"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Grants: everyone can read grants (public data)
CREATE POLICY "Anyone can view grants"
  ON public.grants FOR SELECT
  TO authenticated
  USING (true);

-- Notification history: users can only view their own
CREATE POLICY "Users can view own notifications"
  ON public.notification_history FOR SELECT
  USING (auth.uid() = user_id);

-- Saved grants: users can only access their own
CREATE POLICY "Users can view own saved grants"
  ON public.saved_grants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved grants"
  ON public.saved_grants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved grants"
  ON public.saved_grants FOR DELETE
  USING (auth.uid() = user_id);

-- Grant applications: users can only access their own
CREATE POLICY "Users can view own applications"
  ON public.grant_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications"
  ON public.grant_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications"
  ON public.grant_applications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own applications"
  ON public.grant_applications FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_criteria_updated_at
  BEFORE UPDATE ON public.user_criteria
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_prefs_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grants_updated_at
  BEFORE UPDATE ON public.grants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grant_applications_updated_at
  BEFORE UPDATE ON public.grant_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, NEW.email);

  -- Also create default notification preferences
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
