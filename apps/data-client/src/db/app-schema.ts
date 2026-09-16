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
  uniqueIndex,
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
  (table) => [
    index("installations_userId_idx").on(table.userId),
    // A resolved siteId must be unique - routes/auth.ts's callback upserts
    // on this so reinstalling a site (e.g. after a SCOPES change) replaces
    // that site's row instead of adding a second one. Real bug, found and
    // fixed 2026-09-14: before this constraint existed, a Webflow-initiated
    // reinstall of an already-linked site (unlinked userId) left two rows
    // for the same siteId - harmless as long as at most one of them ever
    // matched an ownsSite() query's (siteId, userId) pair, but the very next
    // Fluxa-initiated reinstall (matching BOTH siteId and userId) would have
    // created a second row that also matched, leaving `.limit(1)` to pick
    // between an old- and new-scope token with no defined order. Postgres
    // treats every NULL as distinct under a unique index, so unresolved
    // installs (siteId still null) are correctly never deduplicated against
    // each other by this.
    uniqueIndex("installations_siteId_idx").on(table.siteId),
  ],
);

export const installationRelations = relations(installations, ({ one }) => ({
  user: one(user, {
    fields: [installations.userId],
    references: [user.id],
  }),
}));

// Session-scoped site access proof - added 2026-09-16 to close a real gap:
// once cms-gallery access dropped per-account collaborator verification
// (settled the same day, see routes/cmsGallery.ts's own getSiteInstallation
// comment), any signed-in Fluxa account presenting a valid siteId could act
// on that site, whether or not they ever had real Designer access to it -
// fine for the "any teammate can use it" goal, but not for a `siteId` that
// leaked outside the Designer entirely (pasted somewhere, screenshotted).
// One row per (siteId, userId) that's currently verified - checked on every
// cms-gallery request (routes/cmsGallery.ts's own requireVerifiedSite),
// upserted by `POST /:siteId/verify` after a real, fresh
// webflow.getIdToken() resolves (server-side, against Webflow itself) to
// this exact siteId. Deliberately a DB row with an expiry, not a signed
// token (JWT-style) - this app has no other hand-rolled signing/verification
// code anywhere, and a plain table+expiry check reuses a pattern already
// proven correct here (same shape as cmsGalleryItemOverrides) rather than
// introducing a new crypto-shaped bug surface right after two real bugs in
// this exact area. Short-lived on purpose (15 min - see EXPIRY_MS in that
// route) so the one genuinely expensive part (the real network round-trip
// to Webflow's own "Resolve ID token" endpoint, ~400-700ms observed) is
// paid once per Designer session opened, not once per click.
export const siteVerifications = pgTable(
  "site_verifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("site_verifications_site_user_idx").on(table.siteId, table.userId),
  ],
);

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

// Bridges the Google sign-in popup back to the Designer Extension iframe -
// see routes/oauthPopupExchange.ts for the full mechanism. Real, confirmed
// necessity, not speculative: better-auth's own oauth-popup plugin's
// postMessage relay (window.opener.postMessage) never arrives in practice,
// because accounts.google.com sets its own Cross-Origin-Opener-Policy:
// same-origin, which permanently severs window.opener the moment the popup
// navigates there mid-flow - confirmed via real testing (the popup closes
// itself right on schedule, but the opener never receives anything). This
// table is the fallback: the iframe already knows a random `nonce` before
// it ever opens the popup, so it can poll the server for that nonce's
// outcome directly - no window-reference channel needed at all. One row
// per in-flight attempt, single-use (deleted the moment it's read) and
// short-lived (`createdAt`, filtered server-side to a few minutes - stale
// rows are cleanup's problem, this table sees very low volume). `token` is
// better-auth's own raw session-token cookie value (safe to store briefly -
// it's already exactly what a real session cookie holds; this just isn't
// persisted anywhere long-lived), `errorCode`/`redirectTo` carry a failed
// attempt's outcome instead (see auth.ts's oauthPopup plugin comment for
// what these two mean).
export const oauthPopupHandoffs = pgTable("oauth_popup_handoffs", {
  nonce: text("nonce").primaryKey(),
  token: text("token"),
  errorCode: text("error_code"),
  redirectTo: text("redirect_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// "Webflow Solutions" feature #1: multi-image CMS fields inside a Collection
// List (Webflow has no native way to bind a multi-image field to anything -
// not even a Code Component prop, see routes/cmsGallery.ts's own comment).
// One row per collection+field a customer has configured through Fluxa's
// panel - routes/publicCmsGallery.ts's public, unauthenticated route reads
// this by `id` (never by raw collectionId/fieldSlug, which the published
// site never sees) to know which installation's access token and which
// field to resolve for a given item slug. Keyed on `fieldSlug`, not a
// Data-API field id: the Designer Extension's own panel discovers multi-image
// fields via the Designer API's `DynamoWrapperElement.searchAvailableFields()`
// (CollectionListAvailableField), which only ever exposes a field's `slug` -
// and `slug` is also exactly what indexes a live item's `fieldData` object
// (see getLiveCollectionItemBySlug's caller in publicCmsGallery.ts), so
// there's no second identifier worth also tracking.
export const cmsGalleryConfigs = pgTable(
  "cms_gallery_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id").notNull(),
    collectionId: text("collection_id").notNull(),
    fieldSlug: text("field_slug").notNull(),
    // Which Fluxa account created this specific gallery - added 2026-09-15.
    // Any authenticated Fluxa account with access to this site can
    // list/create galleries (see routes/cmsGallery.ts's own
    // getSiteInstallation comment), but only this config's own creator can
    // edit/delete it (that router's own isConfigOwner) - the Designer
    // Extension shows it as disabled, not hidden, to everyone else.
    // Nullable for the same reason installations.userId is - rows created
    // before this column existed have no recorded creator, treated as
    // editable by anyone rather than locking out whoever's already been
    // managing it.
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    // Carousel display settings - read live by routes/publicCmsGallery.ts on
    // every request (not baked into the embed script at install time), so a
    // customer tweaking these in the wizard takes effect on next page load
    // with no need to re-run "Install gallery script". `objectFit` is plain
    // text (not a pgEnum) validated at the zod layer (schema/cmsGallery.ts)
    // instead - matches fieldSlug's own precedent above of not reaching for
    // a DB-level type for a small fixed set of values.
    showArrows: boolean("show_arrows").default(true).notNull(),
    showDots: boolean("show_dots").default(true).notNull(),
    autoplay: boolean("autoplay").default(true).notNull(),
    autoplayIntervalMs: integer("autoplay_interval_ms").default(5000).notNull(),
    objectFit: text("object_fit").default("cover").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("cms_gallery_configs_siteId_idx").on(table.siteId),
    // Per explicit direction ("evitar duplicados") - re-submitting the same
    // collection+field for a site updates nothing new, it's the same
    // gallery config already registered.
    uniqueIndex("cms_gallery_configs_site_collection_field_idx").on(
      table.siteId,
      table.collectionId,
      table.fieldSlug,
    ),
  ],
);

// Per-item image visibility, added 2026-09-15 for the "which images/items
// actually show in the carousel" picker (routes/cmsGalleryItems.ts). One row
// per (config, item) that has ANY override - no row at all means "show
// everything", the default. Keyed by itemSlug, not the item's Webflow id -
// same reasoning cmsGalleryConfigs' own fieldSlug-not-fieldId comment gives:
// slug is what routes/publicCmsGallery.ts already resolves a rendered page's
// item by, so it's the one identifier both sides already share. Individual
// hidden images are keyed by their Webflow Asset fileId (stable across a
// re-order/re-caption, unlike array index) - hiddenImageIds is a plain
// jsonb string array rather than a child table since it's always read/written
// as one whole set per item (the picker's own "select which of these N
// images are hidden" UI has no per-image row of its own metadata to store).
export const cmsGalleryItemOverrides = pgTable(
  "cms_gallery_item_overrides",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    configId: text("config_id")
      .notNull()
      .references(() => cmsGalleryConfigs.id, { onDelete: "cascade" }),
    itemSlug: text("item_slug").notNull(),
    // Hides the item's entire gallery (the carousel renders empty/"no
    // images" for it) - independent of hiddenImageIds, which only makes
    // sense when this is false.
    hidden: boolean("hidden").default(false).notNull(),
    hiddenImageIds: jsonb("hidden_image_ids").$type<string[]>().default([]).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("cms_gallery_item_overrides_configId_idx").on(table.configId),
    uniqueIndex("cms_gallery_item_overrides_config_item_idx").on(table.configId, table.itemSlug),
  ],
);
