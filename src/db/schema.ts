import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamps.createdAt,
});

// One workspace per user. Every brand / folder / asset row hangs off a workspace,
// so authorization is a single `workspace_id = session.workspaceId` filter.
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  createdAt: timestamps.createdAt,
});

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    primaryColor: varchar("primary_color", { length: 7 }).notNull(),
    secondaryColor: varchar("secondary_color", { length: 7 }).notNull(),
    logoUrl: text("logo_url"),
    fontName: varchar("font_name", { length: 120 }),
    ...timestamps,
  },
  (t) => [
    check("brands_primary_hex", sql`${t.primaryColor} ~ '^#[0-9A-Fa-f]{6}$'`),
    check("brands_secondary_hex", sql`${t.secondaryColor} ~ '^#[0-9A-Fa-f]{6}$'`),
  ],
);

export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Deleting a parent is blocked at the API level when it has children;
    // `restrict` keeps the DB honest if that check is ever bypassed.
    parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, {
      onDelete: "restrict",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    // 1 = root-level folder. Max depth is enforced in the service layer.
    depth: smallint("depth").notNull().default(1),
    ...timestamps,
  },
  (t) => [
    index("folders_workspace_parent_idx").on(t.workspaceId, t.parentId),
    check("folders_depth_range", sql`${t.depth} between 1 and 3`),
  ],
);

export const assetType = pgEnum("asset_type", ["image", "video", "logo", "document", "font"]);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Trashed assets may still point at a folder; if that folder is later deleted
    // they fall back to the root so a restore always has somewhere to land.
    folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
    name: varchar("name", { length: 200 }).notNull(),
    type: assetType("type").notNull(),
    url: text("url").notNull(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    description: text("description"),
    usageSuggestion: text("usage_suggestion"),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("assets_workspace_folder_idx").on(t.workspaceId, t.folderId, t.deletedAt),
    index("assets_workspace_deleted_idx").on(t.workspaceId, t.deletedAt),
    check("assets_url_https", sql`${t.url} ~ '^https://'`),
  ],
);

export type User = typeof users.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type AssetType = (typeof assetType.enumValues)[number];
