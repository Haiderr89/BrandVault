"use client";

import clsx from "clsx";
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderOpen,
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
import { createPortal } from "react-dom";
import { api, ApiError, useApi } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import type { Asset, Folder } from "@/lib/types";
import { Button, EmptyState, ErrorState, Select, useToast } from "../ui";
import { AiTagsModal, TagList } from "./ai-tags-modal";
import { AssetFormModal } from "./asset-form-modal";
import { TypeChip } from "./asset-icon";
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

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {folderId ? (current?.name ?? " ") : "Library"}
          </h1>
          <p className="text-muted mt-1 text-sm">
            {searching
              ? "Searching across your whole library"
              : assets.data && subfolders.data
                ? `${plural(folderList.length, "folder")} · ${plural(assetList.length, "asset")}`
                : " "}
          </p>
        </div>
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
                    {folderList.map((f, i) => (
                      <FolderCard
                        key={f.id}
                        index={i}
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
              <AssetSkeletons />
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
                {assetList.map((a, i) => (
                  <AssetCard
                    key={a.id}
                    index={i}
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
        drop.over && "bg-accent/15 text-accent-ink",
      )}
    >
      {children}
    </Link>
  );
}

type MenuItem = { label: string; icon: ReactNode; onClick: () => void; danger?: boolean };
type MenuPosition = { right: number; top?: number; bottom?: number };

/**
 * Kebab menu rendered in a portal with fixed positioning, so it isn't clipped
 * by the card's overflow and flips upward when there's no room below.
 */
function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [pos, setPos] = useState<MenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  function toggle() {
    if (open || !buttonRef.current) return setPos(null);
    const r = buttonRef.current.getBoundingClientRect();
    const menuHeight = items.length * 36 + 10;
    const right = window.innerWidth - r.right;
    const fitsBelow = r.bottom + 4 + menuHeight <= window.innerHeight - 8;
    setPos(fitsBelow ? { right, top: r.bottom + 4 } : { right, bottom: window.innerHeight - r.top + 4 });
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className={clsx(
          "hover:bg-surface-2 hover:text-fg rounded-md p-1.5",
          open ? "bg-surface-2 text-fg" : "text-muted",
        )}
      >
        <MoreHorizontal className="size-4" />
      </button>
      {pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={pos}
            className="border-line bg-surface animate-pop fixed z-50 w-48 overflow-hidden rounded-xl border py-1 shadow-xl shadow-black/20"
          >
            {items.map((it) => (
              <button
                key={it.label}
                role="menuitem"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPos(null);
                  it.onClick();
                }}
                className={clsx(
                  "hover:bg-surface-2 focus-visible:bg-surface-2 flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none",
                  it.danger && "text-danger",
                )}
              >
                {it.icon}
                {it.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

function FolderCard({
  folder,
  index,
  onOpen,
  onRename,
  onDelete,
  onDropAsset,
}: {
  folder: Folder;
  index: number;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDropAsset: (id: string) => void;
}) {
  const drop = useDropTarget(onDropAsset);
  return (
    <div
      {...drop.props}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className={clsx(
        "group animate-rise bg-surface relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 transition",
        drop.over
          ? "border-accent ring-accent/25 scale-[1.02] ring-4"
          : "border-line hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="bg-accent-soft text-accent-ink relative grid size-10 shrink-0 place-items-center rounded-lg transition group-hover:scale-105">
          {drop.over ? (
            <FolderOpen className="size-5" aria-hidden />
          ) : (
            <FolderIcon className="size-5" aria-hidden />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{folder.name}</span>
          <span className="text-muted block text-xs">{drop.over ? "Drop to move here" : "Open folder"}</span>
        </span>
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
  index,
  showFolder,
  onEdit,
  onAi,
  onTrash,
}: {
  asset: Asset;
  index: number;
  showFolder: boolean;
  onEdit: () => void;
  onAi: () => void;
  onTrash: () => void;
}) {
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, asset.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      className="group animate-rise border-line bg-surface hover:border-accent/30 flex flex-col overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5"
    >
      <div className="relative">
        <a
          href={asset.url}
          target="_blank"
          rel="noreferrer noopener"
          className="bg-surface-2 block aspect-[4/3] overflow-hidden"
          tabIndex={-1}
        >
          <AssetThumb asset={asset} />
        </a>
        <TypeChip
          type={asset.type}
          className="bg-surface/90 absolute top-2.5 left-2.5 shadow-sm backdrop-blur"
        />
        <button
          onClick={onAi}
          title="Generate tags with AI"
          aria-label={`Generate tags for ${asset.name}`}
          className="bg-surface/90 text-accent-ink hover:bg-accent hover:text-accent-fg absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Sparkles className="size-4" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold" title={asset.name}>
              <a href={asset.url} target="_blank" rel="noreferrer noopener" className="hover:underline">
                {asset.name}
              </a>
            </h3>
            <p className="text-muted mt-0.5 truncate text-xs">
              Updated {timeAgo(asset.updatedAt)}
              {showFolder && (
                <>
                  {" "}
                  · in <span className="text-fg">{asset.folderName ?? "Library"}</span>
                </>
              )}
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
        {asset.description && (
          <p className="text-muted line-clamp-2 text-xs leading-relaxed">{asset.description}</p>
        )}
        <TagList tags={asset.tags} />
        {asset.tags.length === 0 && (
          <button
            onClick={onAi}
            className="border-accent/30 text-accent-ink hover:bg-accent-soft mt-auto inline-flex items-center gap-1.5 self-start rounded-full border border-dashed px-2.5 py-1 text-xs font-medium transition"
          >
            <Sparkles className="size-3.5" aria-hidden /> Generate tags
          </button>
        )}
      </div>
    </article>
  );
}

function AssetSkeletons() {
  return (
    <div
      role="status"
      aria-label="Loading assets"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="border-line bg-surface overflow-hidden rounded-2xl border">
          <div className="bg-surface-2 aspect-[4/3] animate-pulse" />
          <div className="space-y-2 p-3.5">
            <div className="bg-surface-2 h-3.5 w-2/3 animate-pulse rounded" />
            <div className="bg-surface-2 h-3 w-1/3 animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
