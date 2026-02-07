-- RPC: book_individual_session
-- Locks coach_availability row, validates is_available, inserts booking, sets is_available=false.
CREATE OR REPLACE FUNCTION book_individual_session(
  p_coach_id uuid,
  p_player_id uuid,
  p_parent_id uuid,
  p_session_type_id uuid,
  p_booking_date date,
  p_booking_time time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_availability_id uuid;
  v_booking_id uuid;
  v_slot_date date;
  v_slot_time time;
BEGIN
  SELECT id, slot_date, slot_time
  INTO v_availability_id, v_slot_date, v_slot_time
  FROM coach_availability
  WHERE coach_id = p_coach_id
    AND slot_date = p_booking_date
    AND slot_time = p_booking_time
    AND is_available = true
  FOR UPDATE;

  IF v_availability_id IS NULL THEN
    RETURN jsonb_build_object('booking_id', null, 'error_message', 'Slot not available or already booked');
  END IF;

  INSERT INTO individual_session_bookings (
    coach_id,
    player_id,
    parent_id,
    session_type_id,
    coach_availability_id,
    booking_date,
    booking_time,
    status
  ) VALUES (
    p_coach_id,
    p_player_id,
    p_parent_id,
    p_session_type_id,
    v_availability_id,
    p_booking_date,
    p_booking_time,
    'confirmed'
  )
  RETURNING id INTO v_booking_id;

  UPDATE coach_availability
  SET is_available = false, updated_at = now()
  WHERE id = v_availability_id;

  RETURN jsonb_build_object('booking_id', v_booking_id, 'error_message', null);
END;
$$;
