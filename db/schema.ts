import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const dealerProfiles = pgTable("dealer_profiles", {
  organizationId: text("organization_id").primaryKey(),
  publicSlug: text("public_slug").notNull(),
  dealerName: text("dealer_name").notNull(),
  destinationName: text("destination_name").notNull().default("Sales team"),
  destinationEmail: text("destination_email"),
  destinationPhone: text("destination_phone"),
  messageSubject: text("message_subject").notNull().default("Driver's license copy"),
  messageBody: text("message_body").notNull().default("Attached is the requested copy of my driver's license."),
  backMode: text("back_mode").notNull().default("required"),
  pageSize: text("page_size").notNull().default("letter"),
  layout: text("layout").notNull().default("stacked"),
  quality: text("quality").notNull().default("high"),
  labels: boolean("labels").notNull().default(true),
  cropMarks: boolean("crop_marks").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("dealer_profiles_public_slug_idx").on(table.publicSlug)]);

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => dealerProfiles.organizationId, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id"),
  actorType: text("actor_type").notNull().default("customer"),
  eventType: text("event_type").notNull(),
  deliveryChannel: text("delivery_channel"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("activity_events_org_created_idx").on(table.organizationId, table.createdAt),
  index("activity_events_actor_idx").on(table.organizationId, table.actorUserId),
]);

export const billingSubscriptions = pgTable("billing_subscriptions", {
  organizationId: text("organization_id").primaryKey(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  status: text("status").notNull().default("checkout_pending"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("billing_subscriptions_customer_idx").on(table.stripeCustomerId),
  uniqueIndex("billing_subscriptions_subscription_idx").on(table.stripeSubscriptionId),
]);
