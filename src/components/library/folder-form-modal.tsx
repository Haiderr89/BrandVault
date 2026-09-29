"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import type { Folder } from "@/lib/types";
import { Button, Field, FormError, Input, Modal } from "../ui";

export function FolderFormModal({
  open,
  onClose,
  onSaved,
  parentId,
  folder,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (folder: Folder) => void;
  parentId: string | null;
  folder?: Folder | null; // rename mode when set
}) {
  const [name, setName] = useState(folder?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ folder: Folder }>(folder ? `/api/folders/${folder.id}` : "/api/folders", {
        method: folder ? "PATCH" : "POST",
        body: folder ? { name } : { name, parentId },
      });
      onSaved(res.folder);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={folder ? "Rename folder" : "New folder"} open={open} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="Folder name">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Campaigns"
              maxLength={120}
              required
            />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {folder ? "Rename" : "Create folder"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
