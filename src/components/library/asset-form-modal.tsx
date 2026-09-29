"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError, useApi } from "@/lib/api-client";
import type { Asset, AssetType, Folder } from "@/lib/types";
import { Button, Field, FormError, Input, Modal, Select } from "../ui";
import { ASSET_TYPE_META } from "./asset-icon";
import { FolderPicker } from "./folder-picker";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (asset: Asset) => void;
  asset?: Asset | null; // edit mode when set
  defaultFolderId: string | null;
};

export function AssetFormModal({ open, onClose, onSaved, asset, defaultFolderId }: Props) {
  const folders = useApi<{ folders: Folder[] }>(open ? "/api/folders?all=true" : null);
  // Mounted fresh each time the modal opens (see the `key` in LibraryView),
  // so initial state comes straight from props.
  const [name, setName] = useState(asset?.name ?? "");
  const [type, setType] = useState<AssetType>(asset?.type ?? "image");
  const [url, setUrl] = useState(asset?.url ?? "");
  const [folderId, setFolderId] = useState<string | null>(asset ? asset.folderId : defaultFolderId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await api<{ asset: Asset }>(asset ? `/api/assets/${asset.id}` : "/api/assets", {
        method: asset ? "PATCH" : "POST",
        body: { name, type, url, folderId },
      });
      onSaved(res.asset);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message);
      setFieldErrors(e.details ?? {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={asset ? "Edit asset" : "Add asset"} open={open} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="Name" error={fieldErrors.name?.[0]}>
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              aria-invalid={!!fieldErrors.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer sale banner"
              maxLength={200}
              required
            />
          )}
        </Field>
        <Field label="Type" error={fieldErrors.type?.[0]}>
          {(id, d) => (
            <Select
              id={id}
              aria-describedby={d}
              value={type}
              onChange={(e) => setType(e.target.value as AssetType)}
            >
              {Object.entries(ASSET_TYPE_META).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="URL" error={fieldErrors.url?.[0]} hint="Must be an https:// link.">
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              aria-invalid={!!fieldErrors.url}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://cdn.example.com/banner.png"
              required
            />
          )}
        </Field>
        <Field label="Folder" error={fieldErrors.folderId?.[0]}>
          {(id) =>
            folders.loading ? (
              <Select id={id} disabled>
                <option>Loading folders…</option>
              </Select>
            ) : (
              <FolderPicker
                id={id}
                folders={folders.data?.folders ?? []}
                value={folderId}
                onChange={setFolderId}
              />
            )
          }
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {asset ? "Save changes" : "Add asset"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
