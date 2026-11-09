-- Track the last Inventia lookup separately from the last successful price read.
ALTER TABLE ingredients ADD COLUMN latest_price_attempted_at text;

-- Linked prices saved before the per-basis conversion keep the raw per-100 value;
-- clearing the check time makes the next view refetch and convert them.
UPDATE ingredients SET latest_price_updated_at = NULL WHERE inventia_item_id IS NOT NULL;
