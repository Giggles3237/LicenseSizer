ALTER TABLE "dealer_profiles" ADD COLUMN "public_address" text;--> statement-breakpoint
ALTER TABLE "dealer_profiles" ADD COLUMN "public_phone" text;--> statement-breakpoint
ALTER TABLE "dealer_profiles" ADD COLUMN "public_email" text;--> statement-breakpoint
ALTER TABLE "dealer_profiles" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "dealer_profiles" ADD COLUMN "facebook_url" text;--> statement-breakpoint
ALTER TABLE "dealer_profiles" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "dealer_profiles" ADD COLUMN "landing_headline" text DEFAULT 'A faster, more private way to share your license.' NOT NULL;--> statement-breakpoint
ALTER TABLE "dealer_profiles" ADD COLUMN "landing_description" text DEFAULT 'Create a properly sized PDF on your device and send it directly to our team. Your license images are never uploaded to LicenseResizer.' NOT NULL;--> statement-breakpoint
ALTER TABLE "dealer_profiles" ADD COLUMN "landing_cta" text DEFAULT 'Scan my license' NOT NULL;--> statement-breakpoint
ALTER TABLE "dealer_profiles" ADD COLUMN "landing_theme" text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE "dealer_profiles" ADD COLUMN "brand_color" text DEFAULT '#123f55' NOT NULL;--> statement-breakpoint
ALTER TABLE "dealer_profiles" ADD COLUMN "accent_color" text DEFAULT '#168b79' NOT NULL;