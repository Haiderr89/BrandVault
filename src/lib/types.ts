// Client-side shapes of API responses (dates arrive as ISO strings).
export type AssetType = "image" | "video" | "logo" | "document" | "font";

export type Asset = {
  id: string;
  name: string;
  type: AssetType;
  url: string;
  folderId: string | null;
  folderName?: string | null;
  tags: string[];
  description: string | null;
  usageSuggestion: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  createdAt: string;
  updatedAt: string;
};

export type Brand = {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  fontName: string | null;
  updatedAt: string;
};

export type AiSuggestion = { tags: string[]; description: string; usage_suggestion: string };
