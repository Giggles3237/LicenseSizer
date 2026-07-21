import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("card-free trials cancel safely and reuse an open checkout", async () => {
  const [checkout, dashboard, sync, billing, envExample] = await Promise.all([
    readFile(new URL("../app/api/admin/billing/checkout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/billing/sync/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/billing.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(checkout, /payment_method_collection: trialDays \? "if_required" : "always"/);
  assert.match(checkout, /missing_payment_method: "cancel"/);
  assert.match(checkout, /checkout\.sessions\.list\(\{ customer: customerId, status: "open"/);
  assert.match(checkout, /planType === "individual"/);
  assert.match(checkout, /priceIdForPlan\(planType\)/);
  assert.match(checkout, /success_url\?\.includes\("session_id=\{CHECKOUT_SESSION_ID\}"\)/);
  assert.match(checkout, /session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.match(dashboard, /100 PDFs\/month/);
  assert.match(dashboard, /openBilling\("checkout", "individual"\)/);
  assert.match(dashboard, /checkout"\) !== "success"/);
  assert.match(dashboard, /\/api\/admin\/billing\/sync/);
  assert.match(sync, /checkout\.sessions\.retrieve\(sessionId\)/);
  assert.match(sync, /syncStripeSubscription/);
  assert.match(billing, /INDIVIDUAL_MONTHLY_PDF_LIMIT = 100/);
  assert.match(envExample, /STRIPE_INDIVIDUAL_PRICE_ID/);
});

test("individual plans enforce a monthly PDF quota before generation", async () => {
  const [scanner, activity, quota, usage, schema, migration] = await Promise.all([
    readFile(new URL("../app/license-resizer-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/activity/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/activity/quota/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/usage.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_clear_gorgon.sql", import.meta.url), "utf8"),
  ]);
  assert.match(scanner, /checkPdfQuota/);
  assert.match(scanner, /\/api\/activity\/quota/);
  assert.match(scanner, /await checkPdfQuota\(\)/);
  assert.match(activity, /eventType === "pdf_created"/);
  assert.match(activity, /status: 402/);
  assert.match(quota, /getMonthlyPdfUsage/);
  assert.match(usage, /used < limit/);
  assert.match(schema, /monthlyPdfLimit/);
  assert.match(migration, /monthly_pdf_limit/);
});

test("product copy distinguishes handoff actions from confirmed delivery", async () => {
  const [scanner, dashboard, data, marketing, support] = await Promise.all([
    readFile(new URL("../app/license-resizer-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/dealer-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/support/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(scanner, /Copy a destination if needed, then share the attached PDF/);
  assert.match(scanner, /<span>Email<\/span>/);
  assert.match(scanner, /<span>Text<\/span>/);
  assert.match(scanner, /Share <span/);
  assert.doesNotMatch(scanner, /Open email draft|Open text draft|Before printing|You control the handoff/);
  assert.match(dashboard, /cannot confirm that a customer sent the file or that your team received it/);
  assert.match(support, /cannot confirm delivery/);
  assert.match(support, /Actual size or 100%/);
  assert.match(data, /handoffActions/);
  assert.doesNotMatch(marketing, /PDF delivered|Delivery opened|Your team receives/);
});

test("trust center and guided launch checklist are present", async () => {
  const [dashboard, dashboardPage, privacy, terms, security, subprocessors, support] = await Promise.all([
    readFile(new URL("../app/dashboard/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/security/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/subprocessors/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/support/page.tsx", import.meta.url), "utf8"),
  ]);
  for (const step of ["Confirm dealership page", "Add a handoff destination", "Review capture rules", "Activate the free trial", "Test the customer flow", "Invite or review your team", "Share the customer link"]) assert.match(dashboard, new RegExp(step));
  assert.match(dashboardPage, /signed-in-as/);
  assert.match(dashboardPage, /Signed in as/);
  assert.match(privacy, /does not provide an image or PDF upload endpoint/);
  assert.match(terms, /No verification or confirmed delivery/);
  assert.match(security, /Data boundary/);
  assert.match(subprocessors, /Clerk/);
  assert.match(support, /Never send a license image/);
});
