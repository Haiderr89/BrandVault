import { FileText, Film, Image as ImageIcon, Stamp, Type } from "lucide-react";
import type { AssetType } from "@/lib/types";

// Each type gets its own hue so a grid of mixed assets scans at a glance.
export const ASSET_TYPE_META: Record<
  AssetType,
  { label: string; icon: typeof FileText; chip: string; tile: string }
> = {
  image: {
    label: "Image",
    icon: ImageIcon,
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    tile: "from-sky-400/30 via-sky-300/10 to-transparent text-sky-600 dark:text-sky-300",
  },
  video: {
    label: "Video",
    icon: Film,
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    tile: "from-rose-400/30 via-rose-300/10 to-transparent text-rose-600 dark:text-rose-300",
  },
  logo: {
    label: "Logo",
    icon: Stamp,
    chip: "bg-accent-soft text-accent-ink",
    tile: "from-accent/30 via-accent/10 to-transparent text-accent-ink",
  },
  document: {
    label: "Document",
    icon: FileText,
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    tile: "from-amber-400/30 via-amber-300/10 to-transparent text-amber-600 dark:text-amber-300",
  },
  font: {
    label: "Font",
    icon: Type,
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    tile: "from-emerald-400/30 via-emerald-300/10 to-transparent text-emerald-600 dark:text-emerald-300",
  },
};

export function AssetIcon({ type, className }: { type: AssetType; className?: string }) {
  const Icon = ASSET_TYPE_META[type].icon;
  return <Icon className={className} aria-hidden />;
}

export function TypeChip({ type, className = "" }: { type: AssetType; className?: string }) {
  const meta = ASSET_TYPE_META[type];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${meta.chip} ${className}`}
    >
      <AssetIcon type={type} className="size-3" />
      {meta.label}
    </span>
  );
}
