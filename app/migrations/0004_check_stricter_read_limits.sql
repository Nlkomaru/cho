-- Preflight for the stricter limits that readers now enforce (list sizes in recipes and meals,
-- and the Inventia item ID format). If this migration fails with "malformed JSON", an existing
-- row exceeds a limit; fix that row first, then apply the migration again. Nothing is modified.

-- ingredients.inventia_item_id must be 1-128 characters of A-Z, a-z, 0-9, "-" and "_".
SELECT json('{') WHERE EXISTS (
  SELECT 1 FROM ingredients
  WHERE inventia_item_id IS NOT NULL
    AND (
      length(trim(inventia_item_id)) NOT BETWEEN 1 AND 128
      OR trim(inventia_item_id) GLOB '*[^A-Za-z0-9_-]*'
    )
);

-- dishes.recipe_json top-level lists.
SELECT json('{') WHERE EXISTS (
  SELECT 1 FROM dishes
  WHERE json_array_length(recipe_json, '$.equipment') > 50
    OR json_array_length(recipe_json, '$.ingredientGroups') > 50
    OR json_array_length(recipe_json, '$.globalCautions') > 50
);

-- dishes.recipe_json step lists.
SELECT json('{') WHERE EXISTS (
  SELECT 1 FROM dishes, json_each(dishes.recipe_json, '$.steps') AS step
  WHERE json_array_length(step.value, '$.dependsOnStepIds') > 50
    OR json_array_length(step.value, '$.resourceTags') > 20
    OR json_array_length(step.value, '$.inputs') > 50
    OR json_array_length(step.value, '$.outputs') > 50
    OR json_array_length(step.value, '$.cautions') > 20
);

-- dishes.recipe_json ingredient group members.
SELECT json('{') WHERE EXISTS (
  SELECT 1 FROM dishes, json_each(dishes.recipe_json, '$.ingredientGroups') AS grp
  WHERE json_array_length(grp.value, '$.ingredientEntryIds') > 100
);

-- Meals with more than 100 items, or items with more than 100 cost breakdown entries.
SELECT json('{') WHERE EXISTS (
  SELECT 1 FROM meal_log_items GROUP BY meal_log_id HAVING count(*) > 100
);
SELECT json('{') WHERE EXISTS (
  SELECT 1 FROM meal_log_items WHERE json_array_length(ingredient_cost_breakdown_json) > 100
);
