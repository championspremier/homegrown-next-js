"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { ArrowLeft, Upload, X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "../solo-create.module.css";
import type { Category, SkillThumbnail } from "../solo-create-client";
import {
  ALL_TECHNICAL_SKILLS,
  PHYSICAL_SKILLS,
  MENTAL_SKILLS,
  formatLabel,
} from "@/lib/curriculum";

interface Props {
  thumbnails: SkillThumbnail[];
  onBack: () => void;
  onSaved: (thumb: SkillThumbnail) => void;
}

const CATEGORIES: Category[] = ["technical", "physical", "mental", "tactical"];
const TACTICAL_PERIODS = ["build-out", "middle-third", "final-third", "wide-play", "all"];
const PHYSICAL_SEASONS = ["in-season", "off-season"];

const SKILLS_BY_CATEGORY: Record<string, string[]> = {
  technical: ALL_TECHNICAL_SKILLS,
  physical: PHYSICAL_SKILLS,
  mental: MENTAL_SKILLS,
};

function getExt(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "jpg";
}

export default function ThumbnailManager({ thumbnails, onBack, onSaved }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<Category>("technical");
  const [period, setPeriod] = useState("build-out");
  const [skill, setSkill] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const periodOptions = useMemo(() => {
    if (category === "physical") return PHYSICAL_SEASONS;
    return TACTICAL_PERIODS;
  }, [category]);

  const skillOptions = useMemo(() => {
    return SKILLS_BY_CATEGORY[category] || [];
  }, [category]);

  const showSkillDropdown = category !== "tactical";

  const filteredThumbnails = useMemo(() => {
    return thumbnails.filter((t) => t.category === category);
  }, [thumbnails, category]);

  function handleCategoryChange(c: Category) {
    setCategory(c);
    setSkill("");
    setSuccessMsg(null);
    if (c === "physical") {
      setPeriod("in-season");
    } else if (c === "mental") {
      setPeriod("all");
    } else {
      setPeriod("build-out");
    }
  }

  function validateAndSetFile(f: File) {
    if (!f.type.startsWith("image/") && f.type !== "video/mp4") {
      setUploadError("Only image or MP4 video files are accepted.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setUploadError("File must be under 5MB.");
      return;
    }
    setUploadError(null);
    setSuccessMsg(null);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSetFile(f);
  }, []);

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
  }

  const canUpload = file && category && period;
  const isVideo = file?.type === "video/mp4";

  async function handleUpload() {
    if (!file || !category || !period) return;
    setUploading(true);
    setUploadError(null);
    setSuccessMsg(null);

    const supabase = createClient();
    const ext = getExt(file.name);
    const skillSlug = skill ? skill.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : null;
    const fileName = skillSlug
      ? `${category}-${period}-${skillSlug}-thumbnail.${ext}`
      : `${category}-${period}-thumbnail.${ext}`;
    const storagePath = `skill-thumbnails/${fileName}`;

    try {
      const { error: uploadErr } = await supabase.storage
        .from("solo-session-videos")
        .upload(storagePath, file, { cacheControl: "3600", upsert: true });

      if (uploadErr) throw new Error(uploadErr.message);

      const { data: urlData } = supabase.storage
        .from("solo-session-videos")
        .getPublicUrl(storagePath);

      const thumbnailUrl = `${urlData?.publicUrl || ""}?t=${Date.now()}`;

      const matchSkill = skill || null;
      const { data: existing } = await (supabase as any)
        .from("skill_thumbnails")
        .select("id")
        .eq("category", category)
        .eq("period", period)
        .eq("skill", matchSkill)
        .maybeSingle();

      let record: SkillThumbnail;

      if (existing) {
        const { data, error } = await (supabase as any)
          .from("skill_thumbnails")
          .update({ thumbnail_url: thumbnailUrl })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        record = data;
      } else {
        const { data, error } = await (supabase as any)
          .from("skill_thumbnails")
          .insert({
            category,
            period,
            skill: matchSkill,
            sub_skill: null,
            thumbnail_url: thumbnailUrl,
          })
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        record = data;
      }

      onSaved(record);
      clearFile();
      setSuccessMsg("Thumbnail uploaded!");
    } catch (err: unknown) {
      setUploadError((err as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.thumbManager}>
      <div className={styles.editHeader}>
        <button className={styles.backBtn} onClick={onBack} type="button">
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <h2 className={styles.editTitle}>Manage Thumbnails</h2>
          <p className={styles.editSubtitle}>Upload thumbnails for skill cards in the player Solo view</p>
        </div>
      </div>

      <div className={styles.thumbForm}>
        <label className={styles.fieldLabel}>
          Category
          <select
            className={styles.fieldSelect}
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value as Category)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{formatLabel(c)}</option>
            ))}
          </select>
        </label>

        <label className={styles.fieldLabel}>
          {category === "physical" ? "Season" : "Period"}
          <select
            className={styles.fieldSelect}
            value={period}
            onChange={(e) => { setPeriod(e.target.value); setSuccessMsg(null); }}
          >
            {periodOptions.map((p) => (
              <option key={p} value={p}>{formatLabel(p)}</option>
            ))}
          </select>
        </label>

        {showSkillDropdown && (
          <label className={styles.fieldLabel}>
            Skill
            <select
              className={styles.fieldSelect}
              value={skill}
              onChange={(e) => { setSkill(e.target.value); setSuccessMsg(null); }}
            >
              <option value="">No skill (category-level)</option>
              {skillOptions.map((s) => (
                <option key={s} value={s}>{formatLabel(s)}</option>
              ))}
            </select>
          </label>
        )}

        <div
          className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
        >
          {file && previewUrl ? (
            <div className={styles.thumbPreviewWrap}>
              {isVideo ? (
                <video src={previewUrl} className={styles.thumbPreviewMedia} autoPlay loop muted playsInline />
              ) : (
                <img src={previewUrl} alt="Preview" className={styles.thumbPreviewMedia} />
              )}
              <button className={styles.thumbPreviewRemove} onClick={(e) => { e.stopPropagation(); clearFile(); }} type="button">
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <Upload size={28} className={styles.dropIcon} />
              <span className={styles.dropText}>Drag & drop image or video</span>
              <span className={styles.dropHint}>Image or MP4, max 5MB</span>
            </>
          )}
          <input ref={fileInputRef} type="file" accept="image/*,video/mp4" onChange={handleFileInput} style={{ display: "none" }} />
        </div>

        {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
        {successMsg && (
          <p className={styles.thumbSuccess}>
            <Check size={14} /> {successMsg}
          </p>
        )}

        <div className={styles.thumbFormActions}>
          <button className={styles.cancelBtn} onClick={onBack} type="button">Cancel</button>
          <button className={styles.confirmBtn} onClick={handleUpload} disabled={!canUpload || uploading} type="button">
            {uploading ? "Uploading..." : "Upload Thumbnail"}
          </button>
        </div>
      </div>

      {filteredThumbnails.length > 0 && (
        <div className={styles.thumbExisting}>
          <h3 className={styles.thumbExistingTitle}>
            Existing {formatLabel(category)} Thumbnails
          </h3>
          <div className={styles.thumbGrid}>
            {filteredThumbnails.map((t) => {
              const isVid = t.thumbnail_url.endsWith(".mp4") || t.thumbnail_url.includes("video/mp4");
              return (
                <div key={t.id} className={styles.thumbCard}>
                  <div className={styles.thumbCardMedia}>
                    {isVid ? (
                      <video src={t.thumbnail_url} className={styles.thumbCardImg} autoPlay loop muted playsInline />
                    ) : (
                      <img src={t.thumbnail_url} alt="" className={styles.thumbCardImg} />
                    )}
                  </div>
                  <div className={styles.thumbCardInfo}>
                    <span className={styles.thumbCardSkill}>
                      {t.skill ? formatLabel(t.skill) : "Category Level"}
                    </span>
                    <span className={styles.thumbCardPeriod}>{formatLabel(t.period)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filteredThumbnails.length === 0 && (
        <div className={styles.editEmpty}>
          No thumbnails for {formatLabel(category)} yet.
        </div>
      )}
    </div>
  );
}
