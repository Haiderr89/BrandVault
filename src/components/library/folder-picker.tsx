"use client";

import type { Folder } from "@/lib/types";
import { Select } from "../ui";

/** Flat <select> of every folder, indented by depth and ordered as a tree. */
export function FolderPicker({
  id,
  folders,
  value,
  onChange,
}: {
  id: string;
  folders: Folder[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const ordered: Folder[] = [];
  const walk = (parentId: string | null) => {
    folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((f) => {
        ordered.push(f);
        walk(f.id);
      });
  };
  walk(null);

  return (
    <Select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Library root</option>
      {ordered.map((f) => (
        <option key={f.id} value={f.id}>
          {"   ".repeat(f.depth - 1)}
          {f.depth > 1 ? "└ " : ""}
          {f.name}
        </option>
      ))}
    </Select>
  );
}
