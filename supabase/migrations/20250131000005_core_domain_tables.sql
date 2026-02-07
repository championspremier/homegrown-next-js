-- Core domain tables for scheduling and coaching. No RLS policies.

-- 1. coach_availability
CREATE TABLE public.coach_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_availability_coach_id ON public.coach_availability(coach_id);
CREATE INDEX idx_coach_availability_day ON public.coach_availability(day_of_week);

-- 2. sessions
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_coach_id ON public.sessions(coach_id);
CREATE INDEX idx_sessions_starts_at ON public.sessions(starts_at);

-- 3. session_reservations
CREATE TABLE public.session_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_reservations_session_id ON public.session_reservations(session_id);
CREATE INDEX idx_session_reservations_player_id ON public.session_reservations(player_id);

-- 4. parent_player_relationships
CREATE TABLE public.parent_player_relationships (
  parent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, player_id)
);

CREATE INDEX idx_parent_player_relationships_parent_id ON public.parent_player_relationships(parent_id);
CREATE INDEX idx_parent_player_relationships_player_id ON public.parent_player_relationships(player_id);
