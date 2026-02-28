-- DIAGNOSTIC: Find points/progress rows attributed to parents instead of players.
-- Run the SELECT queries first to check scope before running UPDATEs.

-- 1. Find points_transactions where the player_id is actually a parent
-- SELECT pt.id, pt.player_id, pt.points, pt.session_type, pt.created_at,
--        p.role, p.first_name, p.last_name,
--        ppr.player_id AS linked_player_id
-- FROM points_transactions pt
-- JOIN profiles p ON p.id = pt.player_id
-- LEFT JOIN parent_player_relationships ppr ON ppr.parent_id = pt.player_id
-- WHERE p.role = 'parent';

-- 2. Find player_curriculum_progress where the player_id is a parent
-- SELECT pcp.id, pcp.player_id, pcp.session_id, pcp.completed_at,
--        p.role, p.first_name, p.last_name,
--        ppr.player_id AS linked_player_id
-- FROM player_curriculum_progress pcp
-- JOIN profiles p ON p.id = pcp.player_id
-- LEFT JOIN parent_player_relationships ppr ON ppr.parent_id = pcp.player_id
-- WHERE p.role = 'parent';

-- 3. Find solo bookings where the player_id is a parent
-- SELECT psb.id, psb.player_id, psb.status,
--        p.role, p.first_name, p.last_name,
--        ppr.player_id AS linked_player_id
-- FROM player_solo_session_bookings psb
-- JOIN profiles p ON p.id = psb.player_id
-- LEFT JOIN parent_player_relationships ppr ON ppr.parent_id = psb.player_id
-- WHERE p.role = 'parent';

-- FIX: Reassign points_transactions from parent to their linked player
-- Only run after confirming the SELECT output looks correct.
-- UPDATE points_transactions pt
-- SET player_id = ppr.player_id
-- FROM parent_player_relationships ppr
-- JOIN profiles p ON p.id = pt.player_id
-- WHERE ppr.parent_id = pt.player_id
--   AND p.role = 'parent';

-- FIX: Reassign player_curriculum_progress from parent to their linked player
-- UPDATE player_curriculum_progress pcp
-- SET player_id = ppr.player_id
-- FROM parent_player_relationships ppr
-- JOIN profiles p ON p.id = pcp.player_id
-- WHERE ppr.parent_id = pcp.player_id
--   AND p.role = 'parent';

-- FIX: Reassign solo bookings from parent to their linked player
-- UPDATE player_solo_session_bookings psb
-- SET player_id = ppr.player_id,
--     parent_id = psb.player_id
-- FROM parent_player_relationships ppr
-- JOIN profiles p ON p.id = psb.player_id
-- WHERE ppr.parent_id = psb.player_id
--   AND p.role = 'parent';

-- NOTE: All FIX queries are commented out. Run SELECT queries first to verify
-- scope, then uncomment and run the UPDATEs manually.
