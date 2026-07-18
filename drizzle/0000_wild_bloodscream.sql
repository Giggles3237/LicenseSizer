CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"actor_user_id" text,
	"actor_type" text DEFAULT 'customer' NOT NULL,
	"event_type" text NOT NULL,
	"delivery_channel" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"status" text DEFAULT 'checkout_pending' NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealer_profiles" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"public_slug" text NOT NULL,
	"dealer_name" text NOT NULL,
	"destination_name" text DEFAULT 'Sales team' NOT NULL,
	"destination_email" text,
	"destination_phone" text,
	"message_subject" text DEFAULT 'Driver''s license copy' NOT NULL,
	"message_body" text DEFAULT 'Attached is the requested copy of my driver''s license.' NOT NULL,
	"back_mode" text DEFAULT 'required' NOT NULL,
	"page_size" text DEFAULT 'letter' NOT NULL,
	"layout" text DEFAULT 'stacked' NOT NULL,
	"quality" text DEFAULT 'high' NOT NULL,
	"labels" boolean DEFAULT true NOT NULL,
	"crop_marks" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_organization_id_dealer_profiles_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."dealer_profiles"("organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_org_created_idx" ON "activity_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_actor_idx" ON "activity_events" USING btree ("organization_id","actor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscriptions_customer_idx" ON "billing_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscriptions_subscription_idx" ON "billing_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dealer_profiles_public_slug_idx" ON "dealer_profiles" USING btree ("public_slug");