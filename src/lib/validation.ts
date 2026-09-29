import { z } from "zod";

const trimmed = (max: number, label: string) =>
  z
    .string({ message: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

const hexColor = (label: string) =>
  z
    .string({ message: `${label} is required.` })
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, `${label} must be a hex color like #1A2B3C.`)
    .transform((v) => v.toUpperCase());

const httpsUrl = (label: string) =>
  z
    .string({ message: `${label} is required.` })
    .trim()
    .max(2048, `${label} is too long.`)
    .url(`${label} must be a valid URL.`)
    .refine((v) => v.startsWith("https://"), `${label} must start with https://`);

// "" from an empty form field means "clear this value".
const optionalText = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), schema.nullable());

// ---------- Auth ----------
export const credentialsSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase().max(255),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

// ---------- Brand ----------
export const brandCreateSchema = z.object({
  name: trimmed(120, "Brand name"),
  primaryColor: hexColor("Primary color"),
  secondaryColor: hexColor("Secondary color"),
  logoUrl: optionalText(httpsUrl("Logo URL")).optional(),
  fontName: optionalText(trimmed(120, "Font name")).optional(),
});
export const brandUpdateSchema = brandCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update.");

// ---------- Folders ----------
export const MAX_FOLDER_DEPTH = 3;
export const folderCreateSchema = z.object({
  name: trimmed(120, "Folder name"),
  parentId: z.uuid("Invalid parent folder.").nullish(),
});
export const folderUpdateSchema = z.object({ name: trimmed(120, "Folder name") });

// ---------- Assets ----------
export const ASSET_TYPES = ["image", "video", "logo", "document", "font"] as const;

export const assetCreateSchema = z.object({
  name: trimmed(200, "Asset name"),
  type: z.enum(ASSET_TYPES, { message: `Type must be one of: ${ASSET_TYPES.join(", ")}.` }),
  url: httpsUrl("Asset URL"),
  folderId: z.uuid("Invalid folder.").nullish(),
});
export const assetUpdateSchema = assetCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update.");

export const SORTS = ["updated_desc", "name_asc"] as const;
export type AssetSort = (typeof SORTS)[number];

export const assetListQuerySchema = z.object({
  folderId: z.uuid("Invalid folder.").optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(SORTS).default("updated_desc"),
});

// ---------- AI suggestion ----------
// Used both to validate what the model returns and what the client sends back
// on save, so nothing unvalidated ever reaches the asset record.
export const aiSuggestionSchema = z.object({
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(32, "Each tag must be at most 32 characters."))
    .min(1, "At least one tag is required.")
    .max(10, "At most 10 tags.")
    .transform((tags) => [...new Set(tags)]),
  description: z.string().trim().min(1, "Description is required.").max(300),
  usage_suggestion: z.string().trim().min(1, "Usage suggestion is required.").max(300),
});
export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;
