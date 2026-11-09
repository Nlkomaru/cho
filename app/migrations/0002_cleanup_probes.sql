DELETE FROM dish_ingredients WHERE dish_id IN (
  SELECT id FROM dishes WHERE name IN ('probe-gratin-onion', 'probe-b-gratin-onion', 'probe-d-gratin-onion')
);
--> statement-breakpoint
DELETE FROM dishes WHERE name IN ('probe-gratin-onion', 'probe-b-gratin-onion', 'probe-d-gratin-onion');
--> statement-breakpoint
DELETE FROM dish_ingredients WHERE ingredient_id IN (
  SELECT id FROM ingredients WHERE name = 'tmp-probe' OR normalized_name = 'tmp-probe'
);
--> statement-breakpoint
DELETE FROM ingredients WHERE name = 'tmp-probe' OR normalized_name = 'tmp-probe';
