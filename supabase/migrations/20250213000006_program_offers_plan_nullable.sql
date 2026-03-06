-- Make plan_id nullable (player chooses their own plan)
ALTER TABLE program_offers ALTER COLUMN plan_id DROP NOT NULL;
