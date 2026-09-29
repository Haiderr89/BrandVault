"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, ApiError, useApi } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import type { Asset } from "@/lib/types";
import { AssetIcon, ASSET_TYPE_META } from "./library/asset-icon";
import { Button, EmptyState, ErrorState, Spinner, useToast } from "./ui";

export function TrashView() {
  const { data, error, loading, reload, setData } = useApi<{ assets: Asset[] }>("/api/trash");
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const remove = (id: string) => setData((d) => d && { assets: d.assets.filter((a) => a.id !== id) });

  async function act(asset: Asset, kind: "restore" | "delete") {
    if (kind === "delete" && !confirm(`Permanently delete "${asset.name}"? This can't be undone.`)) return;
    setBusy(asset.id + kind);
    try {
      if (kind === "restore") await api(`/api/assets/${asset.id}/restore`, { method: "POST" });
      else await api(`/api/assets/${asset.id}`, { method: "DELETE" });
      remove(asset.id);
      toast({
        tone: "success",
        message:
          kind === "restore"
            ? `Restored "${asset.name}" to ${asset.folderName ?? "the library root"}`
            : "Deleted permanently",
      });
    } catch (err) {
      toast({ tone: "error", message: (err as ApiError).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
        <p className="text-muted mt-1 text-sm">
          Trashed assets are hidden from the library and search until restored.
        </p>
      </header>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner label="Loading trash…" />
      ) : !data?.assets.length ? (
        <EmptyState
          icon={<Trash2 className="size-5" />}
          title="Trash is empty"
          body="Assets you move to the trash will show up here."
        />
      ) : (
        <ul className="divide-line border-line bg-surface divide-y overflow-hidden rounded-xl border">
          {data.assets.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="bg-surface-2 text-muted grid size-10 shrink-0 place-items-center rounded-lg">
                  <AssetIcon type={a.type} className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-muted text-xs">
                    {ASSET_TYPE_META[a.type].label} · from {a.folderName ?? "Root"} · trashed{" "}
                    {timeAgo(a.deletedAt!)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 sm:shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === a.id + "restore"}
                  disabled={!!busy}
                  onClick={() => act(a, "restore")}
                >
                  <RotateCcw className="size-3.5" aria-hidden /> Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  loading={busy === a.id + "delete"}
                  disabled={!!busy}
                  onClick={() => act(a, "delete")}
                >
                  Delete forever
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
