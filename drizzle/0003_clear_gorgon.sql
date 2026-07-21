ALTER TABLE "billing_subscriptions" ADD COLUMN "plan_type" text DEFAULT 'dealer' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD COLUMN "monthly_pdf_limit" integer;