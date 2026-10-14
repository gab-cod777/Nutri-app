-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active');

-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('lose_weight', 'gain_muscle', 'maintain_weight', 'improve_conditioning', 'body_recomposition');

-- CreateEnum
CREATE TYPE "GoalPace" AS ENUM ('slow', 'moderate', 'aggressive');

-- CreateEnum
CREATE TYPE "TrainingExperience" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "TrainingLocation" AS ENUM ('gym', 'home', 'outdoor', 'hybrid');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('none', 'dumbbells', 'barbell', 'kettlebell', 'resistance_bands', 'pull_up_bar', 'bench', 'cable_machine', 'machines', 'cardio_machine');

-- CreateEnum
CREATE TYPE "DietaryRestriction" AS ENUM ('vegetarian', 'vegan', 'lactose_free', 'gluten_free', 'nut_allergy', 'seafood_allergy', 'egg_allergy', 'halal', 'kosher', 'low_sodium', 'diabetic');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper');

-- CreateEnum
CREATE TYPE "MeasureUnit" AS ENUM ('g', 'ml', 'unit', 'slice', 'cup', 'tablespoon', 'teaspoon', 'scoop');

-- CreateEnum
CREATE TYPE "FoodCategory" AS ENUM ('grain', 'protein', 'dairy', 'vegetable', 'fruit', 'legume', 'fat_oil', 'beverage', 'sweet', 'ultra_processed', 'supplement', 'prepared_dish', 'other');

-- CreateEnum
CREATE TYPE "FoodSource" AS ENUM ('internal', 'external', 'user', 'ai_estimated');

-- CreateEnum
CREATE TYPE "PortionSource" AS ENUM ('ai_estimate', 'user_adjusted', 'manual_entry', 'barcode', 'meal_plan');

-- CreateEnum
CREATE TYPE "PreparationMethod" AS ENUM ('raw', 'boiled', 'steamed', 'grilled', 'baked', 'sauteed', 'fried', 'deep_fried', 'breaded_fried', 'stewed', 'unknown');

-- CreateEnum
CREATE TYPE "ImageQuality" AS ENUM ('good', 'fair', 'poor');

-- CreateEnum
CREATE TYPE "HiddenCalorieRisk" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'full_body', 'cardio');

-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'skipped');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('active', 'archived', 'generating', 'failed');

-- CreateEnum
CREATE TYPE "ProgressMetric" AS ENUM ('weight_kg', 'body_fat_percentage', 'waist_cm', 'hip_cm', 'chest_cm', 'arm_cm', 'thigh_cm');

-- CreateEnum
CREATE TYPE "AiOperation" AS ENUM ('analyze_meal_image');

-- CreateEnum
CREATE TYPE "AiCallStatus" AS ENUM ('success', 'validation_failed', 'provider_error', 'timeout', 'rejected_not_food');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(60) NOT NULL,
    "sex" "Sex" NOT NULL,
    "birth_date" DATE NOT NULL,
    "height_cm" DOUBLE PRECISION NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "body_fat_percentage" DOUBLE PRECISION,
    "target_weight_kg" DOUBLE PRECISION,
    "goal" "Goal" NOT NULL,
    "pace" "GoalPace" NOT NULL DEFAULT 'moderate',
    "activity_level" "ActivityLevel" NOT NULL,
    "training_days_per_week" INTEGER NOT NULL,
    "session_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "experience" "TrainingExperience" NOT NULL,
    "training_location" "TrainingLocation" NOT NULL,
    "available_equipment" "Equipment"[],
    "limitations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "restrictions" "DietaryRestriction"[] DEFAULT ARRAY[]::"DietaryRestriction"[],
    "disliked_foods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "favorite_foods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meals_per_day" INTEGER NOT NULL DEFAULT 4,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    "onboarding_completed_at" TIMESTAMP(3),
    "health_data_consent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_targets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "bmr" DOUBLE PRECISION NOT NULL,
    "tdee" DOUBLE PRECISION NOT NULL,
    "activity_factor" DOUBLE PRECISION NOT NULL,
    "bmr_formula" VARCHAR(20) NOT NULL,
    "calories" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "fiber" DOUBLE PRECISION NOT NULL,
    "goal" "Goal" NOT NULL,
    "pace" "GoalPace" NOT NULL,
    "is_manual_override" BOOLEAN NOT NULL DEFAULT false,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nutrition_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "canonical_name" VARCHAR(60) NOT NULL,
    "brand" VARCHAR(80),
    "category" "FoodCategory" NOT NULL,
    "source" "FoodSource" NOT NULL DEFAULT 'internal',
    "barcode" VARCHAR(14),
    "base_unit" "MeasureUnit" NOT NULL DEFAULT 'g',
    "calories_per_100" DOUBLE PRECISION NOT NULL,
    "protein_per_100" DOUBLE PRECISION NOT NULL,
    "carbs_per_100" DOUBLE PRECISION NOT NULL,
    "fat_per_100" DOUBLE PRECISION NOT NULL,
    "fiber_per_100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sodium_mg_per_100" DOUBLE PRECISION,
    "preparation_method" "PreparationMethod" NOT NULL DEFAULT 'unknown',
    "typical_portion_grams" DOUBLE PRECISION,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "owner_id" UUID,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "source_reference" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "foods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_servings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "food_id" UUID NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "unit" "MeasureUnit" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "grams_equivalent" DOUBLE PRECISION NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "food_servings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "consumed_at" TIMESTAMPTZ(3) NOT NULL,
    "local_date" DATE NOT NULL,
    "title" VARCHAR(140),
    "notes" VARCHAR(500),
    "total_calories" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_protein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_fat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_fiber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "analysis_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_foods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meal_id" UUID NOT NULL,
    "food_id" UUID,
    "name_snapshot" VARCHAR(120) NOT NULL,
    "calories_per_100" DOUBLE PRECISION NOT NULL,
    "protein_per_100" DOUBLE PRECISION NOT NULL,
    "carbs_per_100" DOUBLE PRECISION NOT NULL,
    "fat_per_100" DOUBLE PRECISION NOT NULL,
    "fiber_per_100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" "MeasureUnit" NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "preparation_method" "PreparationMethod" NOT NULL DEFAULT 'unknown',
    "calories" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "fiber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "portion_source" "PortionSource" NOT NULL,
    "ai_confidence" DOUBLE PRECISION,
    "ai_estimated_grams" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_foods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "image_sha256" CHAR(64) NOT NULL,
    "isFood" BOOLEAN NOT NULL,
    "rejection_reason" VARCHAR(200),
    "image_quality" "ImageQuality" NOT NULL,
    "hidden_calorie_risk" "HiddenCalorieRisk" NOT NULL,
    "overall_confidence" DOUBLE PRECISION NOT NULL,
    "needs_confirmation" BOOLEAN NOT NULL,
    "raw_output" JSONB NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "model_version" VARCHAR(30) NOT NULL,
    "processing_ms" INTEGER NOT NULL,
    "was_accepted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'active',
    "starts_on" DATE NOT NULL,
    "target_calories" DOUBLE PRECISION NOT NULL,
    "target_protein" DOUBLE PRECISION NOT NULL,
    "target_carbs" DOUBLE PRECISION NOT NULL,
    "target_fat" DOUBLE PRECISION NOT NULL,
    "rationale" VARCHAR(500),
    "generator_version" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "day_index" INTEGER NOT NULL,
    "total_calories" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_protein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_fat" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "meal_plan_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_meals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "day_id" UUID NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "suggested_time" VARCHAR(5) NOT NULL,
    "preparation_tip" VARCHAR(300),
    "total_calories" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_protein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_fat" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "meal_plan_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meal_id" UUID NOT NULL,
    "food_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" "MeasureUnit" NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "preparation_method" "PreparationMethod" NOT NULL DEFAULT 'unknown',
    "calories_per_100" DOUBLE PRECISION NOT NULL,
    "protein_per_100" DOUBLE PRECISION NOT NULL,
    "carbs_per_100" DOUBLE PRECISION NOT NULL,
    "fat_per_100" DOUBLE PRECISION NOT NULL,
    "fiber_per_100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "substitutes" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "meal_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "canonical_name" VARCHAR(60) NOT NULL,
    "primary_muscle" "MuscleGroup" NOT NULL,
    "secondary_muscles" "MuscleGroup"[] DEFAULT ARRAY[]::"MuscleGroup"[],
    "required_equipment" "Equipment"[],
    "instructions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "common_mistakes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_compound" BOOLEAN NOT NULL,
    "difficulty_level" INTEGER NOT NULL,
    "demo_video_url" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "split" VARCHAR(40) NOT NULL,
    "days_per_week" INTEGER NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'active',
    "starts_on" DATE NOT NULL,
    "rationale" VARCHAR(500),
    "generator_version" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "day_index" INTEGER NOT NULL,
    "focus_muscles" "MuscleGroup"[],
    "estimated_duration_minutes" INTEGER NOT NULL,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workout_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps_min" INTEGER NOT NULL,
    "reps_max" INTEGER NOT NULL,
    "rest_seconds" INTEGER NOT NULL,
    "suggested_load_kg" DOUBLE PRECISION,
    "notes" VARCHAR(200),

    CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "workout_id" UUID NOT NULL,
    "status" "WorkoutStatus" NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "local_date" DATE NOT NULL,
    "duration_seconds" INTEGER,
    "perceived_effort" INTEGER,
    "notes" VARCHAR(500),
    "total_volume_kg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workout_log_id" UUID NOT NULL,
    "workout_exercise_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "notes" VARCHAR(200),

    CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exercise_log_id" UUID NOT NULL,
    "set_number" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "load_kg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rir" INTEGER,
    "is_warmup" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "set_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "metric" "ProgressMetric" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "measured_on" DATE NOT NULL,
    "notes" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "operation" "AiOperation" NOT NULL,
    "status" "AiCallStatus" NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "model_version" VARCHAR(30) NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "error_message" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "nutrition_targets_user_id_effective_from_idx" ON "nutrition_targets"("user_id", "effective_from" DESC);

-- CreateIndex
CREATE INDEX "foods_barcode_idx" ON "foods"("barcode");

-- CreateIndex
CREATE INDEX "foods_owner_id_idx" ON "foods"("owner_id");

-- CreateIndex
CREATE INDEX "foods_category_idx" ON "foods"("category");

-- CreateIndex
CREATE INDEX "foods_name_idx" ON "foods"("name");

-- CreateIndex
CREATE UNIQUE INDEX "foods_canonical_name_owner_id_key" ON "foods"("canonical_name", "owner_id");

-- CreateIndex
CREATE INDEX "food_servings_food_id_idx" ON "food_servings"("food_id");

-- CreateIndex
CREATE UNIQUE INDEX "meals_analysis_id_key" ON "meals"("analysis_id");

-- CreateIndex
CREATE INDEX "meals_user_id_local_date_idx" ON "meals"("user_id", "local_date");

-- CreateIndex
CREATE INDEX "meals_user_id_consumed_at_idx" ON "meals"("user_id", "consumed_at" DESC);

-- CreateIndex
CREATE INDEX "meal_foods_meal_id_idx" ON "meal_foods"("meal_id");

-- CreateIndex
CREATE INDEX "meal_foods_food_id_idx" ON "meal_foods"("food_id");

-- CreateIndex
CREATE INDEX "meal_analyses_user_id_created_at_idx" ON "meal_analyses"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "meal_analyses_user_id_image_sha256_idx" ON "meal_analyses"("user_id", "image_sha256");

-- CreateIndex
CREATE INDEX "meal_analyses_was_accepted_idx" ON "meal_analyses"("was_accepted");

-- CreateIndex
CREATE INDEX "meal_plans_user_id_status_idx" ON "meal_plans"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plan_days_plan_id_day_index_key" ON "meal_plan_days"("plan_id", "day_index");

-- CreateIndex
CREATE INDEX "meal_plan_meals_day_id_idx" ON "meal_plan_meals"("day_id");

-- CreateIndex
CREATE INDEX "meal_plan_items_meal_id_idx" ON "meal_plan_items"("meal_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercises_canonical_name_key" ON "exercises"("canonical_name");

-- CreateIndex
CREATE INDEX "exercises_primary_muscle_idx" ON "exercises"("primary_muscle");

-- CreateIndex
CREATE INDEX "workout_plans_user_id_status_idx" ON "workout_plans"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workouts_plan_id_day_index_key" ON "workouts"("plan_id", "day_index");

-- CreateIndex
CREATE INDEX "workout_exercises_exercise_id_idx" ON "workout_exercises"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "workout_exercises_workout_id_order_key" ON "workout_exercises"("workout_id", "order");

-- CreateIndex
CREATE INDEX "workout_logs_user_id_local_date_idx" ON "workout_logs"("user_id", "local_date" DESC);

-- CreateIndex
CREATE INDEX "workout_logs_user_id_status_idx" ON "workout_logs"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_logs_workout_log_id_workout_exercise_id_key" ON "exercise_logs"("workout_log_id", "workout_exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "set_logs_exercise_log_id_set_number_key" ON "set_logs"("exercise_log_id", "set_number");

-- CreateIndex
CREATE INDEX "progress_logs_user_id_metric_measured_on_idx" ON "progress_logs"("user_id", "metric", "measured_on" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "progress_logs_user_id_metric_measured_on_key" ON "progress_logs"("user_id", "metric", "measured_on");

-- CreateIndex
CREATE INDEX "ai_usage_logs_user_id_created_at_idx" ON "ai_usage_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_usage_logs_operation_status_created_at_idx" ON "ai_usage_logs"("operation", "status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_targets" ADD CONSTRAINT "nutrition_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_servings" ADD CONSTRAINT "food_servings_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "meals_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "meal_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_foods" ADD CONSTRAINT "meal_foods_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_foods" ADD CONSTRAINT "meal_foods_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_analyses" ADD CONSTRAINT "meal_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_days" ADD CONSTRAINT "meal_plan_days_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "meal_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_meals" ADD CONSTRAINT "meal_plan_meals_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "meal_plan_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meal_plan_meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "workout_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_workout_log_id_fkey" FOREIGN KEY ("workout_log_id") REFERENCES "workout_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "workout_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_exercise_log_id_fkey" FOREIGN KEY ("exercise_log_id") REFERENCES "exercise_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_logs" ADD CONSTRAINT "progress_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- SQL manual: restricoes que o Prisma nao expressa no schema.
--
-- ATENCAO: `prisma migrate dev` nao conhece estes indices e pode propor
-- DROP INDEX numa migration futura. Revise toda migration gerada e remova
-- qualquer DROP destes indices.
-- =============================================================================

-- Alimento publico (owner_id NULL) tem canonical_name unico. O unique composto
-- acima nao cobre isso porque o Postgres trata NULLs como distintos.
CREATE UNIQUE INDEX "foods_canonical_name_public_key"
  ON "foods" ("canonical_name")
  WHERE "owner_id" IS NULL;

-- Busca por similaridade (GET /alimentos?q=).
CREATE INDEX "foods_name_trgm_idx" ON "foods" USING GIN ("name" gin_trgm_ops);

-- No maximo um plano ativo por usuario (alimentar e de treino).
CREATE UNIQUE INDEX "meal_plans_one_active_per_user"
  ON "meal_plans" ("user_id") WHERE "status" = 'active';
CREATE UNIQUE INDEX "workout_plans_one_active_per_user"
  ON "workout_plans" ("user_id") WHERE "status" = 'active';

-- No maximo um treino em andamento por usuario (POST /treinos/:id/iniciar -> 409).
CREATE UNIQUE INDEX "workout_logs_one_in_progress_per_user"
  ON "workout_logs" ("user_id") WHERE "status" = 'in_progress';
