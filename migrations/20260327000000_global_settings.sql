-- Migration: Global attendance time window settings
-- Stores admin-configurable settings for check-in/check-out windows.
-- Single-row table enforced by CHECK constraint.

CREATE TABLE IF NOT EXISTS public.global_settings (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    early_checkin_minutes integer NOT NULL DEFAULT 60,
    late_grace_minutes integer NOT NULL DEFAULT 0,
    checkout_window_minutes integer NOT NULL DEFAULT 60,
    max_overtime_minutes integer NOT NULL DEFAULT 180,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the single settings row with defaults
INSERT INTO public.global_settings (id, early_checkin_minutes, late_grace_minutes, checkout_window_minutes, max_overtime_minutes)
VALUES (1, 60, 0, 60, 180)
ON CONFLICT (id) DO NOTHING;

-- RLS: allow authenticated users to read, only admins should update (enforced at API level)
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global_settings"
    ON public.global_settings FOR SELECT
    USING (true);

CREATE POLICY "Admins can update global_settings"
    ON public.global_settings FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert global_settings"
    ON public.global_settings FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
