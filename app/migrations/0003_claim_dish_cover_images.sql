-- Dish covers become media_images owned by the dish. Apply this migration before deploying
-- the code that checks image ownership on save.

-- Drop covers that point at an image owned by something else (for example a meal log).
UPDATE dishes
SET cover_image_id = NULL
WHERE cover_image_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM media_images
    WHERE media_images.id = dishes.cover_image_id
      AND NOT (media_images.target_type = 'unassigned' AND media_images.target_id = 'unassigned')
      AND NOT (media_images.target_type = 'dish' AND media_images.target_id = dishes.id)
  );

-- When several dishes share one cover, only the one with the lowest id keeps it.
UPDATE dishes
SET cover_image_id = NULL
WHERE cover_image_id IS NOT NULL
  AND id <> (
    SELECT MIN(other.id) FROM dishes AS other WHERE other.cover_image_id = dishes.cover_image_id
  );

UPDATE media_images
SET
  target_type = 'dish',
  target_id = (
    SELECT id FROM dishes WHERE dishes.cover_image_id = media_images.id ORDER BY id LIMIT 1
  ),
  sort_order = 0
WHERE target_type = 'unassigned'
  AND target_id = 'unassigned'
  AND id IN (SELECT cover_image_id FROM dishes WHERE cover_image_id IS NOT NULL);
