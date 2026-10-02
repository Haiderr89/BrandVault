"use client";

import clsx from "clsx";
import { useState } from "react";
import type { Asset } from "@/lib/types";
import { ASSET_TYPE_META, AssetIcon } from "./asset-icon";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;

function extension(url: string) {
  try {
    const m = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

// Real preview for image-like URLs; otherwise a type-colored tile with the file extension.
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
        className="size-full object-cover transition duration-500 group-hover:scale-105"
      />
    );
  }

  const ext = extension(asset.url);
  return (
    <div
      className={clsx(
        "relative grid size-full place-items-center bg-gradient-to-br",
        ASSET_TYPE_META[asset.type].tile,
      )}
    >
      <div className="dot-grid absolute inset-0 opacity-40" />
      <div className="relative flex flex-col items-center gap-2 transition duration-500 group-hover:scale-110">
        <AssetIcon type={asset.type} className="size-9" />
        {ext && <span className="font-mono text-[11px] font-semibold tracking-wider opacity-80">.{ext}</span>}
      </div>
    </div>
  );
}
