-- Recipe ingredient entries no longer store a copy of the ingredient name. The display name now
-- comes from the ingredients table, and `label` holds only recipe-specific wording.
-- For each entry that still has `name`:
--   - an entry that already has `label` keeps it, and `name` is removed;
--   - a name equal to the registered ingredient name is removed (label = null);
--   - any other name moves to `label`.
-- Entries without `name` are left as they are, so running this twice changes nothing.
UPDATE dishes
SET recipe_json = json_set(
  recipe_json,
  '$.ingredients',
  (
    SELECT json_group_array(json(migrated.value))
    FROM (
      SELECT
        CASE
          WHEN json_type(entry.value, '$.name') IS NULL THEN entry.value
          WHEN json_type(entry.value, '$.label') IS NOT NULL
            THEN json_remove(entry.value, '$.name')
          WHEN trim(json_extract(entry.value, '$.name')) = '' OR trim(json_extract(entry.value, '$.name')) = (
            SELECT ingredients.name FROM ingredients
            WHERE ingredients.id = json_extract(entry.value, '$.ingredientId')
          )
            THEN json_set(json_remove(entry.value, '$.name'), '$.label', NULL)
          ELSE json_set(
            json_remove(entry.value, '$.name'),
            '$.label',
            trim(json_extract(entry.value, '$.name'))
          )
        END AS value
      FROM json_each(dishes.recipe_json, '$.ingredients') AS entry
      ORDER BY entry.key
    ) AS migrated
  )
)
WHERE EXISTS (
  SELECT 1 FROM json_each(dishes.recipe_json, '$.ingredients') AS entry
  WHERE json_type(entry.value, '$.name') IS NOT NULL
);
