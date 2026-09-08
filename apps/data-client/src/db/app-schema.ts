import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const installations = pgTable(
  "installations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id"),
    accessToken: text("access_token").notNull(),
    // Which Fluxa account ran the Webflow install OAuth flow (`/auth/install`
    // -> `/auth/callback`). Nullable because rows created before this column
    // existed have no owner - back-populate before relying on it for authz.
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("installations_userId_idx").on(table.userId)],
);

export const installationRelations = relations(installations, ({ one }) => ({
  user: one(user, {
    fields: [installations.userId],
    references: [user.id],
  }),
}));

export const presets = pgTable(
  "presets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id").notNull(),
    name: text("name").notNull(),
    config: jsonb("config").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("presets_siteId_idx").on(table.siteId)],
);

// --- Curated preset gallery --------------------------------------------------
// Deliberately a *separate* table from `presets` above, not a variant of it -
// `presets` is "a Fluxa user's own saved config for one of their sites"
// (owned by siteId, no license/publish concept at all). This is Fluxa's own
// curated template gallery (built by an admin via apps/preset-admin, browsed
// by every customer via the Designer Extension's Presets tab - currently
// still rendering mock data, see designer-extension's PresetsTab.tsx/
// types/presetGallery.ts). No siteId/userId ownership column, since every row
// here belongs to Fluxa itself, not to one customer. `isPublished` lets an
// admin save a draft without it showing up anywhere customer-facing yet -
// every real read path should filter on it except the admin tool's own list,
// which needs to see drafts too.
export const galleryPresetLicenseEnum = pgEnum("gallery_preset_license", ["free", "pro"]);

// Which shader tech a row's `config` renders with - "shaderGradient" (the
// only kind that ever existed before this column was added, hence the
// default backfilling every pre-existing row) or "glassLiquid" (the
// cursor-interactive fluted-glass shader, apps/designer-extension's
// GlassLiquidCanvas.tsx). See packages/gradient-core's galleryPresetSchema
// (a discriminated union on this same field) for why `config`'s jsonb shape
// varies by kind rather than every row being one fixed shape.
export const galleryPresetKindEnum = pgEnum("gallery_preset_kind", [
  "shaderGradient",
  "glassLiquid",
  "ruidoEvolutivo",
]);

export const galleryPresets = pgTable("gallery_presets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  license: galleryPresetLicenseEnum("license").notNull().default("free"),
  kind: galleryPresetKindEnum("kind").notNull().default("shaderGradient"),
  // Either a gradientConfigSchema (kind: "shaderGradient") or a
  // glassLiquidConfigSchema (kind: "glassLiquid") - see packages/gradient-core's
  // galleryPresetSchema discriminated union. jsonb needs no migration to
  // hold either shape; `kind` above is what tells every reader which one
  // it's looking at.
  config: jsonb("config").notNull(),
  isPublished: boolean("is_published").notNull().default(false),
  // Nullable - a preset can exist (and even be published) with no captured
  // thumbnail yet, falling back to a CSS-gradient approximation client-side
  // (see designer-extension's PresetCard.tsx). Set via the dedicated
  // POST /api/gallery-presets/:id/thumbnail route (apps/preset-admin's
  // "Capture thumbnail" button), not the general PATCH - same
  // separate-route-per-upload pattern routes/profile.ts's avatar already
  // uses, not a field on createGalleryPresetSchema.
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Profile & preferences -------------------------------------------------
// 1:1 extensions of better-auth's `user` table (name/email/image already live
// there) - do not duplicate auth-owned fields here, see CLAUDE.md.

export const themeEnum = pgEnum("theme", ["light", "dark"]);

export const userProfiles = pgTable("user_profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  language: text("language"),
  timezone: text("timezone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const userPreferences = pgTable("user_preferences", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  theme: themeEnum("theme").default("dark").notNull(),
  emailNotifications: boolean("email_notifications").default(true).notNull(),
  pushNotifications: boolean("push_notifications").default(true).notNull(),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// --- Billing -----------------------------------------------------------

export const billingIntervalEnum = pgEnum("billing_interval", [
  "month",
  "year",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "succeeded",
  "failed",
  "pending",
  "refunded",
  "canceled",
]);

export const plans = pgTable("plans", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").default("usd").notNull(),
  billingInterval: billingIntervalEnum("billing_interval").notNull(),
  providerPriceId: text("provider_price_id"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").notNull(),
    provider: text("provider").default("stripe").notNull(),
    providerSubscriptionId: text("provider_subscription_id")
      .notNull()
      .unique(),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end")
      .default(false)
      .notNull(),
    trialStart: timestamp("trial_start"),
    trialEnd: timestamp("trial_end"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("subscriptions_userId_idx").on(table.userId),
    index("subscriptions_planId_idx").on(table.planId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(
      () => subscriptions.id,
      { onDelete: "set null" },
    ),
    provider: text("provider").default("stripe").notNull(),
    providerPaymentId: text("provider_payment_id").notNull().unique(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").default("usd").notNull(),
    status: paymentStatusEnum("status").notNull(),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("payments_userId_idx").on(table.userId),
    index("payments_subscriptionId_idx").on(table.subscriptionId),
  ],
);

// Independent log, deliberately not FK'd to users/subscriptions/payments -
// a provider webhook can arrive before (or without) a matching local record.
export const paymentEvents = pgTable("payment_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  provider: text("provider").default("stripe").notNull(),
  providerEventId: text("provider_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  processed: boolean("processed").default(false).notNull(),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userProfileRelations = relations(userProfiles, ({ one }) => ({
  user: one(user, {
    fields: [userProfiles.userId],
    references: [user.id],
  }),
}));

export const userPreferencesRelations = relations(
  userPreferences,
  ({ one }) => ({
    user: one(user, {
      fields: [userPreferences.userId],
      references: [user.id],
    }),
  }),
);

export const planRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionRelations = relations(
  subscriptions,
  ({ one, many }) => ({
    user: one(user, {
      fields: [subscriptions.userId],
      references: [user.id],
    }),
    plan: one(plans, {
      fields: [subscriptions.planId],
      references: [plans.id],
    }),
    payments: many(payments),
  }),
);

export const paymentRelations = relations(payments, ({ one }) => ({
  user: one(user, {
    fields: [payments.userId],
    references: [user.id],
  }),
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.id],
  }),
}));
