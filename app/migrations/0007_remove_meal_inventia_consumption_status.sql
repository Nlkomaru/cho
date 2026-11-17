-- Move Inventia stock consumption from meal logs to dishes/recipes.
ALTER TABLE `meal_logs` DROP COLUMN `inventia_consumption_status`;
