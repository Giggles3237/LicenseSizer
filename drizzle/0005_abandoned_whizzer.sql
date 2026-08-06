CREATE TABLE "marketing_contacts" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"role" text,
	"crm" text,
	"referral_source" text,
	"notes" text,
	"email_opt_in" boolean DEFAULT true NOT NULL,
	"internal_signup_notified_at" timestamp with time zone,
	"trial_started_notified_at" timestamp with time zone,
	"thank_you_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_contacts" ADD CONSTRAINT "marketing_contacts_organization_id_dealer_profiles_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."dealer_profiles"("organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketing_contacts_email_idx" ON "marketing_contacts" USING btree ("contact_email");--> statement-breakpoint
CREATE INDEX "marketing_contacts_user_idx" ON "marketing_contacts" USING btree ("clerk_user_id");