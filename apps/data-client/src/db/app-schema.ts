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

// Per-post visibility, independent of any gallery config - powers "Handle
// CMS visibility" (WebflowSolutionsScreen.tsx's own CmsVisibilityScreen),
// which hides/shows a Collection Item on ANY collection discovered on the
// current Designer page, whether or not a Fluxa gallery is even configured
// for it. Deliberately a separate table from cmsGalleryItemOverrides above
// (not a repurposing of it) - that one is scoped to one specific
// `configId`, so two different galleries configured against the SAME
// collection would each need their own independent hidden-state under that
// model, which isn't what this feature is: hiding a post here is a property
// of the (site, collection, item) itself, so it's keyed directly on that
// triple instead. One row per item that has ANY override - no row means
// "visible" (the default), same "no row = show everything" convention
// cmsGalleryItemOverrides already set. routes/publicCmsGallery.ts's own
// per-item lookup also checks this table (in addition to any gallery-
// specific override) so hiding a post here is honored by an already-
// configured gallery for that same collection too - see that route's own
// comment for the one real limitation this doesn't cover (a collection with
// no gallery/embed installed at all has nothing on the published site to
// actually enforce this against yet).
export const cmsItemVisibility = pgTable(
  "cms_item_visibility",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id").notNull(),
    collectionId: text("collection_id").notNull(),
    itemSlug: text("item_slug").notNull(),
    hidden: boolean("hidden").default(false).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("cms_item_visibility_site_collection_idx").on(table.siteId, table.collectionId),
    uniqueIndex("cms_item_visibility_site_collection_item_idx").on(
      table.siteId,
      table.collectionId,
      table.itemSlug,
    ),
  ],
);

// The "Hide all posts?" master switch at the top of CmsVisibilityScreen.tsx
// - deliberately its own tiny site-scoped settings row, not a column bolted
// onto cmsGalleryConfigs (scoped per gallery, not per site) or a special
// sentinel row inside cmsItemVisibility above (that table is per-ITEM, this
// is a blanket override with no item of its own). When true, EVERY post
// across EVERY collection on this site reads as hidden regardless of its
// own individual cmsItemVisibility/cmsGalleryItemOverrides row -
// routes/publicCmsGallery.ts checks it as one more OR term alongside those
// two. Matches the screen's own subtitle wording exactly ("Override
// individual post settings") - turning this on doesn't erase or change any
// individual post's own stored hidden state, it just overrides what's
// actually shown while it's on; turning it back off reverts to each post's
// own setting with nothing to restore.
export const cmsSiteVisibilitySettings = pgTable("cms_site_visibility_settings", {
  siteId: text("site_id").primaryKey(),
  hideAllPosts: boolean("hide_all_posts").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// "CMS images" (WebflowSolutionsScreen.tsx's third Webflow Solutions
// feature, its own CmsImagesScreen) - lets a customer put a single CMS
// image (any `Image`-type field, not just `MultiImage`) onto any real
// Webflow `Image` element anywhere in the project, with none of the
// multi-image gallery's own machinery: `ImageElement.setAsset()` +
// `webflow.getAssetById()` are both real Designer API calls (confirmed
// against the installed @webflow/designer-extension-typings package, not
// assumed) that set a NATIVE image binding directly - no HTML Embed, no
// runtime script, no public route, nothing for a published site to load at
// all. This table is pure bookkeeping for the "Reused images" list
// (WebflowSolutionsScreen.tsx's screenshot reference calls it "Your
// galeries", renamed - these aren't galleries, nothing here plays a
// carousel) - the real image binding lives entirely inside Webflow's own
// page data once applied, this row just remembers which CMS image was
// last pushed to which target so the customer has something to review/
// change/remove later.
//
// `itemName` is a denormalized SNAPSHOT of the source post's name at the
// moment this was created/last changed, not a live value - re-fetching it
// live on every list render would mean one Webflow API round trip per row
// just to paint a list, for a label that's already right the overwhelming
// majority of the time. Genuinely goes stale only if that CMS item is
// later renamed, which is an acceptable, low-stakes trade-off for a purely
// informational subtitle. `assetId` is the Webflow Asset id actually
// applied (same id `webflow.getAssetById()` needs, and the same stable
// identifier the multi-image gallery's own `fileId` already uses) -
// captured at apply time so "Manage" (re-picking a different image for the
// same target) has something concrete to diff against, and so a future
// "which image is this" thumbnail doesn't need a fresh CMS read either.
//
// No `elementId` column - a raw Designer element id isn't a reliable
// enough handle to persist (see the designer-extension CLAUDE.md's own
// AppliedGradientsMenu section on why this app already avoids that
// anywhere else). The real target is instead found the same way
// AppliedGradientsMenu already finds its own applied-gradient elements: a
// plain HTML marker attribute (`data-fluxa-cms-image-config`, this row's
// own `id`) set directly on the target Image element, discovered by
// scanning `webflow.getAllElements()` on whichever page is currently open -
// same real, already-documented, accepted "current page only" limitation
// that scan already has elsewhere in this app.
export const cmsImageReuses = pgTable(
  "cms_image_reuses",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id").notNull(),
    collectionId: text("collection_id").notNull(),
    itemSlug: text("item_slug").notNull(),
    itemName: text("item_name").notNull(),
    fieldSlug: text("field_slug").notNull(),
    assetId: text("asset_id").notNull(),
    // Same authorship convention as cmsGalleryConfigs.createdByUserId -
    // any site collaborator can see every reuse, only its own creator can
    // Manage/Delete it (routes/cmsImages.ts's own isReuseOwner).
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("cms_image_reuses_siteId_idx").on(table.siteId)],
);

// "Blog to staging" (routes/blogStaging.ts, BlogToStagingScreen.tsx) - lets
// a customer mark a Collection Item as "staging only": visible when the
// visitor is on the site's own staging (`*.webflow.io`) domain, hidden when
// they're on the live/custom domain - something Webflow's own publish
// system genuinely cannot do per item (confirmed against Webflow's own
// docs: publishing to staging-only vs. production-only domains is a
// SITE-WIDE choice in the Publish modal, not a per-CMS-item one; a
// Draft/unpublished item doesn't render on ANY published domain, staging
// included, so there's no native "visible on staging, hidden on live"
// state at all). Enforced by a small site-wide script
// (ensureBlogStagingScriptInstalled, routes/blogStaging.ts) that compares
// the visitor's own hostname against the item's stored flag here via
// routes/publicBlogStaging.ts - this table is what that public route reads.
//
// Keyed by (siteId, itemSlug) only, NOT (siteId, collectionId, itemSlug)
// like cmsItemVisibility/cmsGalleryItemOverrides - a real, deliberate,
// documented trade-off: the runtime script only ever has the current
// page's own URL slug to go on (there's no marker-attribute mechanism here
// the way the multi-image gallery has, since this needs to work site-wide
// with zero manual per-item marking step), so the public lookup can only
// ever be by slug within a site, not scoped further to which collection
// that slug's item belongs to. Two DIFFERENT collections on the same site
// sharing an identical item slug would collide here (whichever was set
// last wins) - accepted as a rare, low-stakes edge case rather than adding
// real complexity to solve it.
//
// The "All posts to staging?" master toggle (BlogToStagingScreen.tsx) is
// NOT a separate override table the way CmsVisibilityScreen's own
// "Hide all posts?" is - it's a real bulk WRITE across every currently-
// loaded item's own row here instead (see routes/blogStaging.ts's own
// staging-all route), specifically because a non-destructive derived
// override (computed at read time) would need to know every item's own
// collection scope to apply "all posts in the collection I'm looking at"
// correctly, which - per the same reasoning above - this table's own
// slug-only keying can't cleanly express as a separate layer.
export const blogStagingItems = pgTable(
  "blog_staging_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id").notNull(),
    collectionId: text("collection_id").notNull(),
    itemSlug: text("item_slug").notNull(),
    stagingOnly: boolean("staging_only").default(false).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("blog_staging_items_siteId_idx").on(table.siteId),
    uniqueIndex("blog_staging_items_site_slug_idx").on(table.siteId, table.itemSlug),
  ],
);

// Tracks whether the site-wide enforcement script (above) has already been
// registered + applied to this site, so a second toggle doesn't try to
// re-register it (Custom Code script VERSIONS are immutable by design, per
// Webflow's own docs - re-registering the same version would fail) or
// re-PUT the site's custom-code list needlessly. One row per site;
// `scriptVersion` is what to bump (registering a genuinely new version) if
// this script's own source ever needs a real fix - never edit
// `BLOG_STAGING_SCRIPT_VERSION` in place and expect an existing site's
// already-applied version to update itself.
export const blogStagingSiteSettings = pgTable("blog_staging_site_settings", {
  siteId: text("site_id").primaryKey(),
  scriptId: text("script_id"),
  scriptVersion: text("script_version"),
  installedAt: timestamp("installed_at"),
});
