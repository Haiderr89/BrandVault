"use client";

import clsx from "clsx";
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { api, ApiError, useApi } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import type { Asset, Folder } from "@/lib/types";
import { Button, EmptyState, ErrorState, Select, Spinner, useToast } from "../ui";
import { AiTagsModal, TagList } from "./ai-tags-modal";
import { AssetFormModal } from "./asset-form-modal";
import { ASSET_TYPE_META } from "./asset-icon";
import { AssetThumb } from "./asset-thumb";
import { FolderFormModal } from "./folder-form-modal";

const MAX_DEPTH = 3;
const DRAG_TYPE = "application/x-brandvault-asset";

export function LibraryView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();

  const folderId = params.get("folder");
  const q = params.get("q") ?? "";
  const sort = params.get("sort") === "name_asc" ? "name_asc" : "updated_desc";
  const searching = q.trim().length > 0;

  const setParams = (next: Record<string, string | null>, mode: "push" | "replace" = "push") => {
    const sp = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const url = `${pathname}${sp.size ? `?${sp}` : ""}`;
    if (mode === "push") {
      router.push(url);
    } else {
      router.replace(url);
    }
  };

  // Debounced search box synced to ?q=
  const [searchText, setSearchText] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    // URL changed externally (back button, folder click): mirror it in the box.
    setSyncedQ(q);
    setSearchText(q);
  }
  useEffect(() => {
    if (searchText === q) return;
    const t = setTimeout(() => setParams({ q: searchText.trim() || null }, "replace"), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const folderInfo = useApi<{ folder: Folder; path: Folder[] }>(folderId ? `/api/folders/${folderId}` : null);
  const subfolders = useApi<{ folders: Folder[] }>(
    searching ? null : `/api/folders${folderId ? `?parentId=${folderId}` : ""}`,
  );
  const assetQuery = new URLSearchParams({ sort });
  if (searching) assetQuery.set("q", q.trim());
  else if (folderId) assetQuery.set("folderId", folderId);
  const assets = useApi<{ assets: Asset[] }>(`/api/assets?${assetQuery}`);

  const current = folderId ? folderInfo.data?.folder : null;
  const path = folderId ? (folderInfo.data?.path ?? []) : [];
  const canNestFolder = !current || current.depth < MAX_DEPTH;

  // Modals
  const [assetModal, setAssetModal] = useState<{ open: boolean; asset: Asset | null }>({
    open: false,
    asset: null,
  });
  const [folderModal, setFolderModal] = useState<{ open: boolean; folder: Folder | null }>({
    open: false,
    folder: null,
  });
  const [aiAsset, setAiAsset] = useState<Asset | null>(null);

  const refresh = () => {
    assets.reload();
    subfolders.reload();
  };

  async function trash(asset: Asset) {
    try {
      await api(`/api/assets/${asset.id}/trash`, { method: "POST" });
      assets.setData((d) => d && { assets: d.assets.filter((a) => a.id !== asset.id) });
      toast({
        tone: "success",
        message: `"${asset.name}" moved to trash`,
        action: {
          label: "Undo",
          run: () =>
            api(`/api/assets/${asset.id}/restore`, { method: "POST" })
              .then(() => assets.reload())
              .catch((e: ApiError) => toast({ tone: "error", message: e.message })),
        },
      });
    } catch (err) {
      toast({ tone: "error", message: (err as ApiError).message });
    }
  }

  async function moveAsset(assetId: string, targetFolderId: string | null) {
    const asset = assets.data?.assets.find((a) => a.id === assetId);
    if (!asset || asset.folderId === targetFolderId) return;
    try {
      await api(`/api/assets/${assetId}`, { method: "PATCH", body: { folderId: targetFolderId } });
      assets.reload();
      toast({ tone: "success", message: `Moved "${asset.name}"` });
    } catch (err) {
      toast({ tone: "error", message: (err as ApiError).message });
    }
  }

  async function deleteFolder(folder: Folder) {
    if (!confirm(`Delete the folder "${folder.name}"?`)) return;
    try {
      await api(`/api/folders/${folder.id}`, { method: "DELETE" });
      subfolders.reload();
      toast({ tone: "success", message: "Folder deleted" });
    } catch (err) {
      toast({ tone: "error", message: (err as ApiError).message });
    }
  }

  if (folderId && folderInfo.error) {
    return (
      <ErrorState
        message={
          folderInfo.error.status === 404
            ? "This folder doesn't exist or was deleted."
            : folderInfo.error.message
        }
        onRetry={folderInfo.error.status === 404 ? () => setParams({ folder: null }) : folderInfo.reload}
      />
    );
  }

  const folderList = subfolders.data?.folders ?? [];
  const assetList = assets.data?.assets ?? [];
  const nothingHere =
    !searching && !assets.loading && !subfolders.loading && folderList.length === 0 && assetList.length === 0;

  return (
    <div>
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="text-muted mb-2 flex flex-wrap items-center gap-1 text-sm">
        <Crumb onDropAsset={(id) => moveAsset(id, null)} href="/library" active={!folderId}>
          Library
        </Crumb>
        {path.map((f, i) => (
          <span key={f.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" aria-hidden />
            <Crumb
              onDropAsset={(id) => moveAsset(id, f.id)}
              href={`/library?folder=${f.id}`}
              active={i === path.length - 1}
            >
              {f.name}
            </Crumb>
          </span>
        ))}
      </nav>

      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {folderId ? (current?.name ?? " ") : "Library"}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setFolderModal({ open: true, folder: null })}
            disabled={!canNestFolder}
            title={canNestFolder ? undefined : `Folders can be nested ${MAX_DEPTH} levels deep`}
          >
            <FolderPlus className="size-4" aria-hidden /> <span className="hidden sm:inline">New folder</span>
          </Button>
          <Button onClick={() => setAssetModal({ open: true, asset: null })}>
            <Plus className="size-4" aria-hidden /> Add asset
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            aria-label="Search assets by name"
            placeholder="Search all assets by name…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="border-line bg-surface focus:border-accent focus:ring-accent/20 h-10 w-full rounded-lg border pr-9 pl-9 text-sm focus:ring-2 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {searchText && (
            <button
              onClick={() => setSearchText("")}
              aria-label="Clear search"
              className="text-muted hover:text-fg absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Select
          aria-label="Sort assets"
          value={sort}
          onChange={(e) =>
            setParams({ sort: e.target.value === "updated_desc" ? null : e.target.value }, "replace")
          }
          className="sm:w-48"
        >
          <option value="updated_desc">Recently updated</option>
          <option value="name_asc">Name (A–Z)</option>
        </Select>
      </div>

      {searching && (
        <p className="text-muted mb-4 text-sm">
          {assets.loading
            ? "Searching…"
            : `${assetList.length} result${assetList.length === 1 ? "" : "s"} for “${q}” across your library`}
        </p>
      )}

      {nothingHere ? (
        <EmptyState
          icon={<Upload className="size-5" />}
          title={folderId ? "This folder is empty" : "Your library is empty"}
          body="Add an asset by URL, or create a folder to organise your brand files."
          action={
            <Button onClick={() => setAssetModal({ open: true, asset: null })}>
              <Plus className="size-4" aria-hidden /> Add asset
            </Button>
          }
        />
      ) : (
        <>
          {/* Folders */}
          {!searching && (
            <section className="mb-8" aria-label="Folders">
              {subfolders.error ? (
                <ErrorState message={subfolders.error.message} onRetry={subfolders.reload} />
              ) : subfolders.loading && !subfolders.data ? null : folderList.length > 0 ? (
                <>
                  <h2 className="text-muted mb-3 text-xs font-medium tracking-wider uppercase">Folders</h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {folderList.map((f) => (
                      <FolderCard
                        key={f.id}
                        folder={f}
                        onOpen={() => setParams({ folder: f.id, q: null })}
                        onRename={() => setFolderModal({ open: true, folder: f })}
                        onDelete={() => deleteFolder(f)}
                        onDropAsset={(id) => moveAsset(id, f.id)}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </section>
          )}

          {/* Assets */}
          <section aria-label="Assets">
            {!searching && assetList.length > 0 && (
              <h2 className="text-muted mb-3 text-xs font-medium tracking-wider uppercase">Assets</h2>
            )}
            {assets.error ? (
              <ErrorState message={assets.error.message} onRetry={assets.reload} />
            ) : assets.loading && !assets.data ? (
              <Spinner label="Loading assets…" />
            ) : assetList.length === 0 ? (
              searching ? (
                <EmptyState
                  icon={<Search className="size-5" />}
                  title="No matches"
                  body={`No assets named like “${q}”.`}
                />
              ) : (
                <p className="border-line text-muted rounded-xl border border-dashed px-4 py-8 text-center text-sm">
                  No assets directly in this folder.
                </p>
              )
            ) : (
              <div
                className={clsx(
                  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                  assets.loading && "opacity-60 transition-opacity",
                )}
              >
                {assetList.map((a) => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    showFolder={searching}
                    onEdit={() => setAssetModal({ open: true, asset: a })}
                    onAi={() => setAiAsset(a)}
                    onTrash={() => trash(a)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {assetModal.open && (
        <AssetFormModal
          key={assetModal.asset?.id ?? "new"}
          open
          asset={assetModal.asset}
          defaultFolderId={folderId}
          onClose={() => setAssetModal({ open: false, asset: null })}
          onSaved={(saved) => {
            const editing = !!assetModal.asset;
            setAssetModal({ open: false, asset: null });
            refresh();
            toast({ tone: "success", message: editing ? "Asset updated" : `Added "${saved.name}"` });
          }}
        />
      )}
      {folderModal.open && (
        <FolderFormModal
          key={folderModal.folder?.id ?? "new"}
          open
          folder={folderModal.folder}
          parentId={folderId}
          onClose={() => setFolderModal({ open: false, folder: null })}
          onSaved={() => {
            const renaming = !!folderModal.folder;
            setFolderModal({ open: false, folder: null });
            subfolders.reload();
            if (renaming) folderInfo.reload();
            toast({ tone: "success", message: renaming ? "Folder renamed" : "Folder created" });
          }}
        />
      )}
      {aiAsset && (
        <AiTagsModal
          key={aiAsset.id}
          asset={aiAsset}
          onClose={() => setAiAsset(null)}
          onSaved={() => {
            setAiAsset(null);
            assets.reload();
            toast({ tone: "success", message: "Tags saved" });
          }}
        />
      )}
    </div>
  );
}

// ---------- Pieces ----------

function useDropTarget(onDropAsset: (assetId: string) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => {
        if (e.dataTransfer.types.includes(DRAG_TYPE)) {
          e.preventDefault();
          setOver(true);
        }
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        setOver(false);
        const id = e.dataTransfer.getData(DRAG_TYPE);
        if (id) {
          e.preventDefault();
          onDropAsset(id);
        }
      },
    },
  };
}

function Crumb({
  href,
  active,
  children,
  onDropAsset,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  onDropAsset: (id: string) => void;
}) {
  const drop = useDropTarget(onDropAsset);
  return (
    <Link
      href={href}
      {...drop.props}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "hover:text-fg rounded px-1 py-0.5",
        active && "text-fg font-medium",
        drop.over && "bg-accent/15 text-accent",
      )}
    >
      {children}
    </Link>
  );
}

function Menu({
  label,
  items,
}: {
  label: string;
  items: { label: string; icon: ReactNode; onClick: () => void; danger?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="text-muted hover:bg-surface-2 hover:text-fg rounded-md p-1.5"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="border-line bg-surface absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border py-1 shadow-lg"
        >
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                it.onClick();
              }}
              className={clsx(
                "hover:bg-surface-2 flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                it.danger && "text-danger",
              )}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FolderCard({
  folder,
  onOpen,
  onRename,
  onDelete,
  onDropAsset,
}: {
  folder: Folder;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDropAsset: (id: string) => void;
}) {
  const drop = useDropTarget(onDropAsset);
  return (
    <div
      {...drop.props}
      className={clsx(
        "group bg-surface flex items-center gap-3 rounded-xl border p-3 transition",
        drop.over ? "border-accent bg-accent/5 ring-accent/20 ring-2" : "border-line hover:border-muted/40",
      )}
    >
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="bg-accent/10 text-accent grid size-9 shrink-0 place-items-center rounded-lg">
          <FolderIcon className="size-4" aria-hidden />
        </span>
        <span className="truncate text-sm font-medium">{folder.name}</span>
      </button>
      <Menu
        label={`Actions for folder ${folder.name}`}
        items={[
          { label: "Rename", icon: <Pencil className="size-4" />, onClick: onRename },
          { label: "Delete", icon: <Trash2 className="size-4" />, onClick: onDelete, danger: true },
        ]}
      />
    </div>
  );
}

function AssetCard({
  asset,
  showFolder,
  onEdit,
  onAi,
  onTrash,
}: {
  asset: Asset;
  showFolder: boolean;
  onEdit: () => void;
  onAi: () => void;
  onTrash: () => void;
}) {
  const meta = ASSET_TYPE_META[asset.type];
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, asset.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group border-line bg-surface flex flex-col overflow-hidden rounded-xl border transition hover:shadow-md"
    >
      <a
        href={asset.url}
        target="_blank"
        rel="noreferrer noopener"
        className="bg-surface-2 block aspect-[4/3]"
        tabIndex={-1}
      >
        <AssetThumb asset={asset} />
      </a>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium" title={asset.name}>
              <a href={asset.url} target="_blank" rel="noreferrer noopener" className="hover:underline">
                {asset.name}
              </a>
            </h3>
            <p className="text-muted mt-0.5 text-xs">
              {meta.label} · {timeAgo(asset.updatedAt)}
              {showFolder && <> · {asset.folderName ?? "Root"}</>}
            </p>
          </div>
          <Menu
            label={`Actions for ${asset.name}`}
            items={[
              { label: "Edit / move", icon: <Pencil className="size-4" />, onClick: onEdit },
              { label: "Generate tags", icon: <Sparkles className="size-4" />, onClick: onAi },
              { label: "Move to trash", icon: <Trash2 className="size-4" />, onClick: onTrash, danger: true },
            ]}
          />
        </div>
        {asset.description && <p className="text-muted line-clamp-2 text-xs">{asset.description}</p>}
        <TagList tags={asset.tags} />
        {asset.tags.length === 0 && (
          <button
            onClick={onAi}
            className="text-accent mt-auto inline-flex items-center gap-1 self-start text-xs font-medium hover:underline"
          >
            <Sparkles className="size-3.5" aria-hidden /> Generate tags
          </button>
        )}
      </div>
    </article>
  );
}
