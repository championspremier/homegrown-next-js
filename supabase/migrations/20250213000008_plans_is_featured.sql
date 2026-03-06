-- Add is_featured column to plans table for "Most Popular" badge
ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
