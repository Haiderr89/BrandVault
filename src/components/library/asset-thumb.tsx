"use client";

import { useState } from "react";
import type { Asset } from "@/lib/types";
import { AssetIcon } from "./asset-icon";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;

// Only try to render an <img> for image-like assets; everything else gets a type icon.
export function AssetThumb({ asset }: { asset: Asset }) {
  const [failed, setFailed] = useState(false);
  const looksLikeImage =
    (asset.type === "image" || asset.type === "logo") &&
    (IMAGE_EXT.test(asset.url) || asset.url.includes("images.unsplash.com"));

  if (looksLikeImage && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    );
  }
  return (
    <div className="text-muted grid size-full place-items-center">
      <AssetIcon type={asset.type} className="size-8" />
    </div>
  );
}
