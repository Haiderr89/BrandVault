import { FileText, Film, Image as ImageIcon, Stamp, Type } from "lucide-react";
import type { AssetType } from "@/lib/types";

export const ASSET_TYPE_META: Record<AssetType, { label: string; icon: typeof FileText }> = {
  image: { label: "Image", icon: ImageIcon },
  video: { label: "Video", icon: Film },
  logo: { label: "Logo", icon: Stamp },
  document: { label: "Document", icon: FileText },
  font: { label: "Font", icon: Type },
};

export function AssetIcon({ type, className }: { type: AssetType; className?: string }) {
  const Icon = ASSET_TYPE_META[type].icon;
  return <Icon className={className} aria-hidden />;
}
