"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Send, Trash2, Upload, FileText, Image as ImageIcon, Film } from "lucide-react";
import { useWorksheetWriter } from "@/lib/chatChannels";
import {
  getWorksheetSchema,
  type WorksheetField,
  type WorksheetSchema,
} from "@/lib/worksheetSchemas";
import { uploadFile } from "@/lib/objectiveUpload";

// ── Persistent worksheet popup ─────────────────────────────────────────────
//
// Trigger: WorksheetIcon. Opens a polished modal/bottom-sheet with the form
// for the active objective. Every keystroke debounce-saves the draft to
// localStorage so reopening (or refreshing) restores the answers exactly.
//
// Storage key: `aida:worksheet:{lmsId}:{profileId}:draft`
// Cap: 64 KB per draft (kid-typed text, no PII risk; refuse beyond that).

// What the popup hands off to the validator on Submit. The worksheet popup
// is the SINGLE place the kid uploads anything. The validator just pulls
// this blob + the most-recent whiteboard output and grades.
export interface WorksheetSubmissionPayload {
  lmsId:           string;
  data:            Record<string, string | boolean>;
  worksheetFile?:  { url: string; format: "pdf" | "docx"; filename: string };
  mediaUrls?:      string[];      // image URLs (OBJ 10) OR a single video URL (OBJ 6)
  notes?:          string;
}

interface Props {
  open:             boolean;
  lmsId:            string;
  profileId:        string;
  arenaAccent:      string;
  arenaAccentGlow:  string;
  onClose:          () => void;
  onSubmit:         (payload: WorksheetSubmissionPayload) => Promise<void> | void;
}

const STORAGE_PREFIX = "aida:worksheet:";
const DEBOUNCE_MS    = 400;
const MAX_BYTES      = 64 * 1024;

function storageKey(lmsId: string, profileId: string): string {
  return `${STORAGE_PREFIX}${lmsId}:${profileId}:draft`;
}

interface FullDraft {
  data:           Record<string, string | boolean>;
  worksheetFile?: { url: string; format: "pdf" | "docx"; filename: string };
  mediaUrls?:     string[];
  notes?:         string;
}

function loadDraft(lmsId: string, profileId: string): FullDraft {
  if (typeof window === "undefined") return { data: {} };
  try {
    const raw = localStorage.getItem(storageKey(lmsId, profileId));
    if (!raw) return { data: {} };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.data && typeof parsed.data === "object") {
      return {
        data:          parsed.data,
        worksheetFile: parsed.worksheetFile,
        mediaUrls:     Array.isArray(parsed.mediaUrls) ? parsed.mediaUrls : undefined,
        notes:         typeof parsed.notes === "string" ? parsed.notes : undefined,
      };
    }
    return { data: {} };
  } catch {
    // Corrupt JSON — drop it cleanly so the kid isn't stuck on a poisoned key.
    localStorage.removeItem(storageKey(lmsId, profileId));
    return { data: {} };
  }
}

function saveDraft(
  lmsId:     string,
  profileId: string,
  draft:     FullDraft,
): "ok" | "too_big" {
  const payload = JSON.stringify({
    data:          draft.data,
    worksheetFile: draft.worksheetFile,
    mediaUrls:     draft.mediaUrls,
    notes:         draft.notes,
    updated_at:    new Date().toISOString(),
    version:       2,
  });
  if (payload.length > MAX_BYTES) return "too_big";
  try {
    localStorage.setItem(storageKey(lmsId, profileId), payload);
    return "ok";
  } catch {
    // Quota or otherwise — surface it so the kid can trim.
    return "too_big";
  }
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function isFieldFilled(f: WorksheetField, v: string | boolean | undefined): boolean {
  if (f.kind === "yesno") return typeof v === "boolean";
  const text = typeof v === "string" ? v : "";
  if (!text.trim()) return false;
  if (f.minWords && wordCount(text) < f.minWords) return false;
  return true;
}

function allRequiredFilled(schema: WorksheetSchema, data: Record<string, string | boolean>): boolean {
  // Reflection is post-create; not gating on submit.
  return schema.sections
    .filter(s => s.id !== "reflection")
    .every(s => s.fields.every(f => isFieldFilled(f, data[f.id])));
}

// OBJ 6 = single video. OBJ 10 = multiple images. Used for the media zone.
function mediaConfig(lmsId: string): {
  kind:     "image" | "video";
  accept:   string;
  multiple: boolean;
  label:    string;
  hint:     string;
} {
  if (lmsId === "l1-06") {
    return {
      kind:     "video",
      accept:   "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov",
      multiple: false,
      label:    "Avatar video — required",
      hint:     ".mp4 / .webm / .mov · single file · max 60 MB",
    };
  }
  return {
    kind:     "image",
    accept:   "image/*",
    multiple: true,
    label:    "Comic image(s) — optional",
    hint:     ".png .jpg .webp .gif · multiple allowed",
  };
}

export function WorksheetPopup({
  open, lmsId, profileId, arenaAccent, arenaAccentGlow, onClose, onSubmit,
}: Props) {
  const schema = useMemo(() => getWorksheetSchema(lmsId), [lmsId]);
  const media = useMemo(() => mediaConfig(lmsId), [lmsId]);
  const [data, setData] = useState<Record<string, string | boolean>>({});
  const [worksheetFile, setWorksheetFile] = useState<FullDraft["worksheetFile"]>(undefined);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [worksheetUploading, setWorksheetUploading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writer = useWorksheetWriter();

  // Tell AidaAssistant + WorksheetIcon to hide themselves while the worksheet
  // is open. Same pattern as the validator panel (see TeacherCharacter.tsx).
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(open ? "worksheet-popup-open" : "worksheet-popup-close"));
  }, [open]);

  // Load on open
  useEffect(() => {
    if (!open || !schema) return;
    const initial = loadDraft(lmsId, profileId);
    setData(initial.data);
    setWorksheetFile(initial.worksheetFile);
    setMediaUrls(initial.mediaUrls ?? []);
    setNotes(initial.notes ?? "");
    writer.setDraft(lmsId, initial.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schema, lmsId, profileId]);

  // Tab sync — if another tab updates the same draft, pick it up.
  useEffect(() => {
    if (!schema) return;
    function onStorage(e: StorageEvent) {
      if (e.key !== storageKey(lmsId, profileId)) return;
      const fresh = loadDraft(lmsId, profileId);
      setData(fresh.data);
      setWorksheetFile(fresh.worksheetFile);
      setMediaUrls(fresh.mediaUrls ?? []);
      setNotes(fresh.notes ?? "");
      writer.setDraft(lmsId, fresh.data);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, lmsId, profileId]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Single source of truth for "save the draft now" — used by every change
  // handler so the kid never loses anything they typed/uploaded.
  function persist(next: {
    data?:          Record<string, string | boolean>;
    worksheetFile?: FullDraft["worksheetFile"];
    mediaUrls?:     string[];
    notes?:         string;
  }) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const draft: FullDraft = {
        data:          next.data          ?? data,
        worksheetFile: next.worksheetFile !== undefined ? next.worksheetFile : worksheetFile,
        mediaUrls:     next.mediaUrls     ?? mediaUrls,
        notes:         next.notes         ?? notes,
      };
      const result = saveDraft(lmsId, profileId, draft);
      if (result === "too_big") {
        setTooBig(true);
        writer.setStatus("error");
      } else {
        setTooBig(false);
        setSavedAt(new Date().toISOString());
        writer.setDraft(lmsId, draft.data);
      }
    }, DEBOUNCE_MS);
  }

  function update(id: string, value: string | boolean) {
    setData(prev => {
      const next = { ...prev, [id]: value };
      persist({ data: next });
      return next;
    });
  }

  // ── File uploaders ───────────────────────────────────────────────────────

  async function handleWorksheetUpload(file: File) {
    setUploadError(null);
    setWorksheetUploading(true);
    try {
      const r = await uploadFile(lmsId, "worksheet", file);
      const uploaded = { url: r.url, filename: r.filename, format: (r.format ?? "docx") as "pdf" | "docx" };
      setWorksheetFile(uploaded);
      persist({ worksheetFile: uploaded });
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setWorksheetUploading(false);
    }
  }
  async function handleMediaUpload(file: File) {
    setUploadError(null);
    setMediaUploading(n => n + 1);
    try {
      const r = await uploadFile(lmsId, media.kind, file);
      setMediaUrls(prev => {
        const next = media.multiple ? [...prev, r.url] : [r.url];
        persist({ mediaUrls: next });
        return next;
      });
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setMediaUploading(n => n - 1);
    }
  }
  function removeMedia(idx: number) {
    setMediaUrls(prev => {
      const next = prev.filter((_, i) => i !== idx);
      persist({ mediaUrls: next });
      return next;
    });
  }
  function removeWorksheetFile() {
    setWorksheetFile(undefined);
    persist({ worksheetFile: undefined });
  }
  function updateNotes(v: string) {
    const capped = v.slice(0, 2000);
    setNotes(capped);
    persist({ notes: capped });
  }

  function discard() {
    if (typeof window === "undefined") return;
    if (!window.confirm("Discard draft? This cannot be undone.")) return;
    localStorage.removeItem(storageKey(lmsId, profileId));
    setData({});
    setWorksheetFile(undefined);
    setMediaUrls([]);
    setNotes("");
    setSavedAt(null);
    writer.clear();
  }

  if (!schema) return null;

  // Submit allowed if either:
  //   - all required inline fields filled (kid typed in-app), or
  //   - they uploaded a worksheet file (kid did it offline)
  const inlineFilled = allRequiredFilled(schema, data);
  const canSubmit    = (inlineFilled || !!worksheetFile) && !worksheetUploading && mediaUploading === 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ws-backdrop"
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="ws-shell"
            className="fixed inset-0 z-[201] flex items-end sm:items-center justify-center p-0 sm:p-6 pointer-events-none"
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
          >
            <div
              className="pointer-events-auto w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0F0F1A] shadow-2xl"
              style={{ boxShadow: `0 0 40px ${arenaAccentGlow}` }}
            >
              {/* ── Header ─────────────────────────────────────────────── */}
              <header className="sticky top-0 z-10 flex items-center justify-between gap-2 px-5 py-4 border-b border-white/10 bg-[#0F0F1A]/95 backdrop-blur">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-mono">Worksheet</div>
                  <h2 className="text-lg font-display font-bold" style={{ color: arenaAccent }}>{schema.title}</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/5 transition"
                  aria-label="Close worksheet"
                >
                  <X size={18} />
                </button>
              </header>

              <p className="px-5 pt-4 text-sm text-white/70">{schema.intro}</p>

              {/* ── Body ─────────────────────────────────────────────── */}
              <div className="px-5 py-4 space-y-6">
                {schema.sections.map(section => (
                  <section key={section.id}>
                    <h3 className="text-sm font-display font-bold text-white">{section.title}</h3>
                    {section.subtitle && <p className="text-xs text-white/50 mb-3">{section.subtitle}</p>}
                    <div className="space-y-3 mt-2">
                      {section.fields.map(f => (
                        <div key={f.id}>
                          <label className="block text-xs text-white/70 mb-1">{f.label}</label>

                          {f.kind === "text" && (
                            <input
                              type="text"
                              value={(data[f.id] as string) ?? ""}
                              onChange={e => update(f.id, e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm focus:outline-none focus:border-white/30"
                            />
                          )}

                          {f.kind === "longtext" && (
                            <textarea
                              value={(data[f.id] as string) ?? ""}
                              onChange={e => update(f.id, e.target.value)}
                              rows={f.rows ?? 3}
                              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm focus:outline-none focus:border-white/30 resize-y"
                            />
                          )}

                          {f.kind === "yesno" && (
                            <div className="flex gap-2">
                              {[true, false].map(isYes => {
                                const active = data[f.id] === isYes;
                                return (
                                  <button
                                    key={String(isYes)}
                                    type="button"
                                    onClick={() => update(f.id, isYes)}
                                    className="px-3 py-1.5 rounded-lg text-xs border transition"
                                    style={{
                                      borderColor: active ? arenaAccent : "rgba(255,255,255,0.1)",
                                      color:       active ? arenaAccent : "rgba(255,255,255,0.7)",
                                      background:  active ? `${arenaAccent}1A` : "transparent",
                                    }}
                                  >
                                    {isYes ? "YES" : "NO"}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {(f.kind === "longtext" || f.kind === "text") && (f.weakEx || f.strongEx) && (
                            <div className="mt-1 text-[11px] text-white/40 space-y-0.5">
                              {f.weakEx   && <div>❌ <span className="text-white/35">Weak:</span> {f.weakEx}</div>}
                              {f.strongEx && <div>✅ <span className="text-white/55">Strong:</span> {f.strongEx}</div>}
                            </div>
                          )}

                          {f.kind === "longtext" && f.minWords && typeof data[f.id] === "string" && (
                            <div className="mt-1 text-[10px] text-white/30 font-mono">
                              {wordCount(data[f.id] as string)} / {f.minWords}+ words
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}

                {/* ── Worksheet file upload (alternative to filling inline) ── */}
                <section>
                  <h3 className="text-sm font-display font-bold text-white">📄 Or upload your filled worksheet (.pdf / .docx)</h3>
                  <p className="text-xs text-white/50 mb-2">Optional — fill the form above OR upload your filled worksheet here. Either works.</p>
                  {worksheetFile ? (
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10">
                      <FileText size={16} style={{ color: arenaAccent }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white/90 truncate">{worksheetFile.filename}</div>
                        <div className="text-[10px] text-white/40">{worksheetFile.format.toUpperCase()} · uploaded</div>
                      </div>
                      <button
                        type="button"
                        onClick={removeWorksheetFile}
                        className="text-[11px] px-2 py-1 rounded-md bg-white/[0.06] text-white/70 hover:text-white"
                      >
                        replace
                      </button>
                    </div>
                  ) : (
                    <label
                      className="block rounded-lg border-2 border-dashed border-white/15 px-4 py-3 text-center cursor-pointer hover:border-white/25 transition"
                      style={{ background: "rgba(255,255,255,0.02)" }}
                    >
                      <Upload size={16} className="inline mr-2 text-white/60" />
                      <span className="text-xs text-white/70">
                        {worksheetUploading ? "Uploading…" : "Drop or click to upload .pdf / .docx"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleWorksheetUpload(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </section>

                {/* ── Comic / video upload ── */}
                <section>
                  <h3 className="text-sm font-display font-bold text-white">
                    {media.kind === "video" ? <Film size={16} className="inline mr-1.5" /> : <ImageIcon size={16} className="inline mr-1.5" />}
                    {media.label}
                  </h3>
                  <p className="text-xs text-white/50 mb-2">{media.hint}</p>

                  <label
                    className="block rounded-lg border-2 border-dashed border-white/15 px-4 py-3 text-center cursor-pointer hover:border-white/25 transition"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <Upload size={16} className="inline mr-2 text-white/60" />
                    <span className="text-xs text-white/70">
                      {mediaUploading > 0 ? `Uploading${mediaUploading > 1 ? ` (${mediaUploading})` : ""}…` : `Drop or click to upload`}
                    </span>
                    <input
                      type="file"
                      accept={media.accept}
                      multiple={media.multiple}
                      className="hidden"
                      onChange={e => {
                        Array.from(e.target.files ?? []).forEach(handleMediaUpload);
                        e.target.value = "";
                      }}
                    />
                  </label>

                  {mediaUrls.length > 0 && (
                    <div className={media.kind === "video" ? "mt-2" : "mt-2 grid grid-cols-4 gap-2"}>
                      {mediaUrls.map((url, i) => (
                        <div key={url} className="relative rounded-md overflow-hidden border border-white/10">
                          {media.kind === "video"
                            ? <video src={url} controls className="w-full max-h-64 object-contain bg-black"/>
                            : <img  src={url} alt={`media-${i}`} className="w-full aspect-square object-cover"/>
                          }
                          <button
                            type="button"
                            onClick={() => removeMedia(i)}
                            className="absolute top-1 right-1 rounded-full bg-black/70 text-white text-xs"
                            style={{ width: 20, height: 20 }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ── Notes ── */}
                <section>
                  <h3 className="text-sm font-display font-bold text-white">📝 Notes — optional</h3>
                  <p className="text-xs text-white/50 mb-2">Anything you want the validator to know. Worksheet wins for grading; this is supplementary.</p>
                  <textarea
                    value={notes}
                    onChange={e => updateNotes(e.target.value)}
                    rows={3}
                    placeholder="e.g. 'Panel 3 makes me laugh — Funny Test = yes.'"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm focus:outline-none focus:border-white/30 resize-y"
                  />
                </section>

                {uploadError && (
                  <div className="text-xs text-red-400 px-1">{uploadError}</div>
                )}
              </div>

              {/* ── Footer ─────────────────────────────────────────── */}
              <footer className="sticky bottom-0 px-5 py-3 border-t border-white/10 bg-[#0F0F1A]/95 backdrop-blur flex items-center justify-between gap-2">
                <div className="text-[11px] text-white/50 flex items-center gap-2">
                  {tooBig
                    ? <span className="text-red-400">Too long — trim to save.</span>
                    : savedAt
                      ? <span><Save size={12} className="inline mr-1" />Draft saved</span>
                      : <span>Autosaves as you type</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={discard}
                    className="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5 transition flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Discard
                  </button>
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => onSubmit({
                      lmsId,
                      data,
                      worksheetFile,
                      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
                      notes:     notes.trim().length > 0 ? notes : undefined,
                    })}
                    className="px-4 py-2 rounded-lg text-xs font-display font-bold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    style={{
                      background: canSubmit ? arenaAccent : "rgba(255,255,255,0.05)",
                      color:      canSubmit ? "#08080F" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    <Send size={14} /> Save & ready for validation
                  </button>
                </div>
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
