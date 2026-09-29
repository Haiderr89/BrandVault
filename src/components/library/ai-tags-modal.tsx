"use client";

import { RefreshCw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import type { AiSuggestion, Asset } from "@/lib/types";
import { Button, ErrorState, Field, FormError, Modal, Textarea } from "../ui";

type Props = { asset: Asset | null; onClose: () => void; onSaved: (asset: Asset) => void };

/**
 * Generate → review/edit → save. The suggestion only reaches the database
 * when the user presses "Save to asset".
 */
export function AiTagsModal({ asset, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<AiSuggestion | null>(null);
  const [generating, setGenerating] = useState(true);
  const [genError, setGenError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  const request = useCallback(() => {
    if (!asset) return Promise.resolve();
    return api<{ suggestion: AiSuggestion }>(`/api/assets/${asset.id}/ai-tags`, { method: "POST" })
      .then((res) => {
        setDraft(res.suggestion);
        setGenError(null);
      })
      .catch((err: ApiError) => setGenError(err.message))
      .finally(() => setGenerating(false));
  }, [asset]);

  // Mounted once per asset (keyed in LibraryView), so this runs on open.
  useEffect(() => {
    request();
  }, [request]);

  const generate = () => {
    setGenerating(true);
    setGenError(null);
    request();
  };

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && draft && !draft.tags.includes(t) && draft.tags.length < 10) {
      setDraft({ ...draft, tags: [...draft.tags, t.slice(0, 32)] });
    }
    setTagInput("");
  }
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };

  async function save() {
    if (!asset || !draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await api<{ asset: Asset }>(`/api/assets/${asset.id}/ai-tags/save`, {
        method: "PATCH",
        body: draft,
      });
      onSaved(res.asset);
    } catch (err) {
      setSaveError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="AI tag suggestions" open={!!asset} onClose={onClose} wide>
      {asset && (
        <div className="space-y-5">
          <p className="text-muted text-sm">
            Suggestions for <span className="text-fg font-medium">{asset.name}</span>, based only on its name,
            type, URL, folder and your brand kit. Review and edit before saving.
          </p>

          {generating && (
            <div role="status" className="border-line space-y-3 rounded-xl border p-4">
              <p className="text-muted flex items-center gap-2 text-sm">
                <Sparkles className="text-accent size-4 animate-pulse" aria-hidden /> Asking Claude…
              </p>
              <div className="bg-surface-2 h-3 w-3/4 animate-pulse rounded" />
              <div className="bg-surface-2 h-3 w-1/2 animate-pulse rounded" />
            </div>
          )}

          {!generating && genError && <ErrorState message={genError} onRetry={generate} />}

          {!generating && draft && (
            <>
              <FormError message={saveError} />
              <Field label="Tags" hint="Press Enter to add. Up to 10.">
                {(id, d) => (
                  <div className="border-line bg-surface focus-within:border-accent flex flex-wrap items-center gap-1.5 rounded-lg border p-2">
                    {draft.tags.map((t) => (
                      <span
                        key={t}
                        className="bg-accent/10 text-accent inline-flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs font-medium"
                      >
                        {t}
                        <button
                          type="button"
                          aria-label={`Remove tag ${t}`}
                          onClick={() => setDraft({ ...draft, tags: draft.tags.filter((x) => x !== t) })}
                          className="hover:bg-accent/20 rounded p-0.5"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      id={id}
                      aria-describedby={d}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={onTagKey}
                      onBlur={addTag}
                      placeholder={draft.tags.length ? "" : "Add a tag"}
                      className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
                    />
                  </div>
                )}
              </Field>
              <Field label="Description">
                {(id) => (
                  <Textarea
                    id={id}
                    rows={2}
                    maxLength={300}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Usage suggestion">
                {(id) => (
                  <Textarea
                    id={id}
                    rows={2}
                    maxLength={300}
                    value={draft.usage_suggestion}
                    onChange={(e) => setDraft({ ...draft, usage_suggestion: e.target.value })}
                  />
                )}
              </Field>
            </>
          )}

          <div className="border-line flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button variant="ghost" size="sm" onClick={generate} disabled={generating || saving}>
              <RefreshCw className="size-3.5" aria-hidden /> Regenerate
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Discard
              </Button>
              <Button
                onClick={save}
                loading={saving}
                disabled={!draft || generating || draft.tags.length === 0}
              >
                Save to asset
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function TagList({ tags, max = 4 }: { tags: string[]; max?: number }) {
  if (!tags.length) return null;
  const shown = tags.slice(0, max);
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <span key={t} className="bg-surface-2 text-muted rounded px-1.5 py-0.5 text-[11px]">
          {t}
        </span>
      ))}
      {tags.length > max && <span className="text-muted px-1 text-[11px]">+{tags.length - max}</span>}
    </div>
  );
}
