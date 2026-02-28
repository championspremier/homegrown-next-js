"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { X, Upload, FileVideo, Check, Smartphone, Monitor, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "../solo-create.module.css";
import type { Category, SoloVideo } from "../solo-create-client";
import type { DrillData } from "./DrillItem";
import {
  getSkillsForCategory,
  PHYSICAL_SUB_SKILLS,
  formatLabel,
} from "@/lib/curriculum";

const MAX_SIZE_MB = 75;

export interface AddDrillModalProps {
  category: Category;
  period: string;
  physicalSkill?: string;
  mentalSkill?: string;
  videos: SoloVideo[];
  editDrill?: DrillData | null;
  onClose: () => void;
  onAdd: (drill: DrillData) => void;
  onVideoUploaded: (video: SoloVideo) => void;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getVideoMetadata(file: File): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => reject(new Error("Could not read video metadata"));
    video.src = URL.createObjectURL(file);
  });
}

export default function AddDrillModal({ category, period, physicalSkill, mentalSkill, videos, editDrill, onClose, onAdd, onVideoUploaded }: AddDrillModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTactical = category === "tactical";
  const isMental = category === "mental";
  const isPhysical = category === "physical";
  const showSkillPills = category === "technical" || isPhysical || isMental;
  const showNameField = !isTactical;
  const isEditMode = !!editDrill;

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [skill, setSkill] = useState(editDrill?.skill || physicalSkill || mentalSkill || "");
  const [subSkill, setSubSkill] = useState(editDrill?.sub_skill || "");
  const [customName, setCustomName] = useState(editDrill?.name || "");
  const [coachingPoints, setCoachingPoints] = useState(editDrill?.coaching_points || "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [videoDims, setVideoDims] = useState<{ width: number; height: number; orientation: string; duration: number } | null>(null);

  const [selectedExisting, setSelectedExisting] = useState<SoloVideo | null>(() => {
    if (editDrill) {
      return videos.find((v) => v.id === editDrill.video_id) || null;
    }
    return null;
  });

  const skillOptions = useMemo(
    () => getSkillsForCategory(category, period),
    [category, period]
  );

  const allowedSkillSet = useMemo(() => new Set(skillOptions), [skillOptions]);

  const subSkillOptions = useMemo(() => {
    if (isPhysical && skill) return PHYSICAL_SUB_SKILLS[skill] || [];
    return [];
  }, [isPhysical, skill]);

  const categoryVideos = useMemo(() => {
    const list = videos.filter((v) => v.category === category);
    if (category === "technical") {
      return list.filter((v) => !v.skill || allowedSkillSet.has(v.skill));
    }
    return list;
  }, [videos, category, allowedSkillSet]);

  const skillCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of categoryVideos) {
      const k = v.skill || "";
      counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  }, [categoryVideos]);

  const filteredExisting = useMemo(() => {
    if (!skill) return categoryVideos;
    return categoryVideos.filter((v) => v.skill === skill);
  }, [categoryVideos, skill]);

  useEffect(() => {
    if (category === "technical" && skill && !allowedSkillSet.has(skill)) {
      setSkill("");
    }
  }, [allowedSkillSet, category, skill]);

  useEffect(() => {
    if (subSkillOptions.length === 0) {
      setSubSkill("");
    } else if (subSkill && !subSkillOptions.includes(subSkill)) {
      setSubSkill("");
    }
  }, [subSkillOptions, subSkill]);

  const tacticalAutoTitle = useMemo(() => {
    return `Tactical Video - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }, []);

  const effectiveName = isTactical ? tacticalAutoTitle : customName;

  const generatedFilename = useMemo(() => {
    if (isTactical) {
      return `${period}-tactical-tactical-${Date.now()}.mp4`;
    }
    if (!skill || !effectiveName) return "";
    return `${period}-${category}-${slugify(skill)}-${slugify(effectiveName)}.mp4`;
  }, [period, category, skill, effectiveName, isTactical]);

  const storagePath = useMemo(() => {
    if (isTactical) {
      return `${period}/tactical/${generatedFilename}`;
    }
    if (!skill || !effectiveName) return "";
    return `${period}/${category}/${slugify(skill)}/${generatedFilename}`;
  }, [period, category, skill, effectiveName, generatedFilename, isTactical]);

  const canUpload = isTactical
    ? file !== null
    : file && skill && effectiveName.trim();
  const canAddExisting = selectedExisting !== null;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSetFile(f);
  }, []);

  async function validateAndSetFile(f: File) {
    if (!f.type.startsWith("video/")) {
      setUploadError("Only video files are accepted.");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploadError(`File must be under ${MAX_SIZE_MB}MB.`);
      return;
    }
    setUploadError(null);
    setFile(f);
    setSelectedExisting(null);

    try {
      const meta = await getVideoMetadata(f);
      const orientation = meta.width > meta.height ? "landscape" : "portrait";
      setVideoDims({ width: meta.width, height: meta.height, orientation, duration: meta.duration });
    } catch {
      setVideoDims(null);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSelectExisting(video: SoloVideo) {
    setSelectedExisting(video);
    if (!isEditMode) {
      setCustomName(video.title || "");
      setCoachingPoints(video.description || "");
    }
    if (video.skill) setSkill(video.skill);
    setFile(null);
    setVideoDims(null);
  }

  function startFakeProgress() {
    setUploadProgress(0);
    let current = 0;
    fakeIntervalRef.current = setInterval(() => {
      const increment = 2 + Math.random() * 2;
      current = Math.min(current + increment, 80);
      setUploadProgress(current);
      if (current >= 80 && fakeIntervalRef.current) {
        clearInterval(fakeIntervalRef.current);
        fakeIntervalRef.current = null;
      }
    }, 50);
  }

  function stopFakeProgress() {
    if (fakeIntervalRef.current) {
      clearInterval(fakeIntervalRef.current);
      fakeIntervalRef.current = null;
    }
  }

  function uploadWithProgress(path: string, fileToUpload: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token;
        if (!token) return reject(new Error("Not authenticated"));

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const url = `${supabaseUrl}/storage/v1/object/solo-session-videos/${path}`;

        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("x-upsert", "true");

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            stopFakeProgress();
            const realPercent = (e.loaded / e.total) * 100;
            const displayPercent = 80 + (realPercent / 100) * 15;
            setUploadProgress(Math.min(displayPercent, 95));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const body = JSON.parse(xhr.responseText);
              reject(new Error(body.message || body.error || `Upload failed: ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.send(fileToUpload);
      });
    });
  }

  async function handleUploadAndAdd() {
    if (isTactical && !file) return;
    if (!isTactical && (!file || !skill || !effectiveName.trim())) return;
    setUploading(true);
    setUploadError(null);

    startFakeProgress();

    const supabase = createClient();

    try {
      await uploadWithProgress(storagePath, file!);

      setUploadProgress(95);

      const { data: urlData } = supabase.storage
        .from("solo-session-videos")
        .getPublicUrl(storagePath);

      const videoUrl = urlData?.publicUrl || "";

      const insertData: Record<string, unknown> = {
        video_url: videoUrl,
        period,
        category,
        skill: isTactical ? null : skill || null,
        sub_skill: subSkill || null,
        title: effectiveName.trim(),
        description: coachingPoints.trim() || null,
        difficulty_level: "beginner",
      };

      if (videoDims) {
        insertData.orientation = videoDims.orientation;
        insertData.width = videoDims.width;
        insertData.height = videoDims.height;
        if (videoDims.duration && isFinite(videoDims.duration)) {
          insertData.duration = Math.round(videoDims.duration);
        }
      }

      const { data: dbRecord, error: dbErr } = await (supabase as any)
        .from("solo_session_videos")
        .insert(insertData)
        .select("*")
        .single();

      if (dbErr) throw new Error(dbErr.message);

      setUploadProgress(100);

      onVideoUploaded(dbRecord);

      const drillData: DrillData = {
        video_id: dbRecord.id,
        name: effectiveName.trim(),
        path: storagePath,
        skill: isTactical ? undefined : skill || undefined,
        sub_skill: subSkill || undefined,
        coaching_points: coachingPoints.trim() || undefined,
      };

      if (!isTactical) {
        drillData.rest_time = editDrill?.rest_time ?? 1;
        drillData.reps = editDrill?.reps ?? 10;
        drillData.sets = editDrill?.sets ?? 3;
      }

      console.log("AddDrillModal: upload complete, calling onAdd", drillData);
      onAdd(drillData);

      await new Promise((r) => setTimeout(r, 300));
      setUploadProgress(null);
      onClose();
    } catch (err: unknown) {
      stopFakeProgress();
      setUploadProgress(null);
      setUploadError((err as Error).message || "Upload failed");
      setUploading(false);
    }
  }

  function handleAddExisting() {
    if (!selectedExisting) return;

    const drillData: DrillData = {
      video_id: selectedExisting.id,
      name: (showNameField ? customName.trim() : "") || selectedExisting.title || "Untitled",
      path: selectedExisting.video_url,
      skill: selectedExisting.skill || undefined,
      sub_skill: subSkill || selectedExisting.sub_skill || undefined,
      coaching_points: coachingPoints.trim() || selectedExisting.description || undefined,
    };

    if (!isTactical) {
      drillData.rest_time = editDrill?.rest_time ?? 1;
      drillData.reps = editDrill?.reps ?? 10;
      drillData.sets = editDrill?.sets ?? 3;
    }

    console.log("AddDrillModal: handleAddExisting calling onAdd", drillData);
    onAdd(drillData);
    onClose();
  }

  const isUploadMode = file !== null;
  const isExistingMode = selectedExisting !== null && !file;
  const isUploading = uploadProgress !== null;

  const modalTitle = isEditMode
    ? (isTactical ? "Edit Video" : "Edit Drill")
    : (isTactical ? "Add Video" : "Add Drill");
  const confirmUploadLabel = isEditMode ? "Upload & Update" : (isTactical ? "Upload & Add Video" : "Upload & Add");
  const confirmExistingLabel = isEditMode ? "Update Drill" : (isTactical ? "Add Video" : "Add Drill");

  const progressLabel = uploadProgress !== null
    ? uploadProgress >= 100
      ? "Complete!"
      : uploadProgress >= 95
        ? "Processing..."
        : `${Math.round(uploadProgress)}% — Uploading...`
    : "";

  return (
    <div className={styles.modalOverlay} onClick={isUploading ? undefined : onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{modalTitle}</h2>
          <button className={styles.modalClose} onClick={onClose} disabled={isUploading} type="button"><X size={20} /></button>
        </div>

        <div className={styles.modalBody}>
          <div
            className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ""} ${isUploading ? styles.dropZoneDisabled : ""}`}
            onDragOver={(e) => { if (!isUploading) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={isUploading ? undefined : handleDrop}
            onClick={() => !file && !isUploading && fileInputRef.current?.click()}
          >
            {file ? (
              <div className={styles.fileSelected}>
                <FileVideo size={20} />
                <span className={styles.fileName}>{file.name}</span>
                {videoDims && (
                  <span className={styles.orientationTag}>
                    {videoDims.orientation === "portrait" ? <Smartphone size={13} /> : <Monitor size={13} />}
                    {videoDims.orientation === "portrait" ? "Vertical" : "Horizontal"}
                  </span>
                )}
                <Check size={16} className={styles.fileReady} />
                {!isUploading && (
                  <button className={styles.fileRemove} onClick={(e) => { e.stopPropagation(); setFile(null); setVideoDims(null); }} type="button">
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <>
                <Upload size={28} className={styles.dropIcon} />
                <span className={styles.dropText}>Drag & drop video or click to browse</span>
                <span className={styles.dropHint}>Video files, max {MAX_SIZE_MB}MB</span>
              </>
            )}
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileInput} style={{ display: "none" }} />
          </div>

          {uploadProgress !== null && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${Math.min(uploadProgress, 100)}%` }} />
              </div>
              <span className={styles.progressText}>{progressLabel}</span>
            </div>
          )}

          {isTactical && videoDims && videoDims.duration < 60 && (
            <div className={styles.durationWarning}>
              <AlertTriangle size={14} />
              <span>Tactical videos should be at least 1 minute. This video is {Math.round(videoDims.duration)} seconds.</span>
            </div>
          )}

          {showSkillPills && (
            <div className={styles.skillSection}>
              <span className={styles.fieldLabel}>Skill</span>
              <div className={styles.skillPills}>
                <button
                  className={`${styles.skillPill} ${skill === "" ? styles.skillPillActive : ""}`}
                  onClick={() => setSkill("")}
                  type="button"
                >
                  All
                  {categoryVideos.length > 0 && (
                    <span className={styles.skillBadge}>{categoryVideos.length}</span>
                  )}
                </button>
                {skillOptions.map((s) => {
                  const count = skillCounts[s] || 0;
                  return (
                    <button
                      key={s}
                      className={`${styles.skillPill} ${skill === s ? styles.skillPillActive : ""}`}
                      onClick={() => setSkill(skill === s ? "" : s)}
                      type="button"
                    >
                      {formatLabel(s)}
                      {count > 0 && <span className={styles.skillBadge}>{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {subSkillOptions.length > 0 && (
            <div className={styles.skillSection}>
              <span className={styles.fieldLabel}>Sub-Skill</span>
              <div className={styles.skillPills}>
                {subSkillOptions.map((ss) => (
                  <button
                    key={ss}
                    className={`${styles.skillPill} ${subSkill === ss ? styles.skillPillActive : ""}`}
                    onClick={() => setSubSkill(subSkill === ss ? "" : ss)}
                    type="button"
                  >
                    {formatLabel(ss)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showNameField && (
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                Name
                <input
                  className={styles.fieldInput}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Inside-Outside Dribble"
                />
                {generatedFilename && <span className={styles.fieldHint}>{generatedFilename}</span>}
              </label>
            </div>
          )}

          {isTactical && file && (
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>
                Title (auto-generated)
                <span className={styles.staticValue}>{tacticalAutoTitle}</span>
              </span>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              Coaching Points
              <textarea
                className={styles.fieldTextarea}
                value={coachingPoints}
                onChange={(e) => setCoachingPoints(e.target.value)}
                placeholder="Focus cues, technique reminders..."
                rows={3}
              />
            </label>
          </div>

          <div className={styles.existingSection}>
            <span className={styles.existingHeading}>
              {isEditMode ? "Swap to existing" : "Or select existing"} {isTactical ? "video" : "drill"}
            </span>
            {filteredExisting.length > 0 ? (
              <div className={styles.existingList}>
                {filteredExisting.map((v) => (
                  <button
                    key={v.id}
                    className={`${styles.existingItem} ${selectedExisting?.id === v.id ? styles.existingItemActive : ""}`}
                    onClick={() => handleSelectExisting(v)}
                    type="button"
                  >
                    <span className={styles.existingItemTitle}>
                      {v.title || "Untitled"}
                      {(v as any).orientation && (
                        <span className={styles.existingOrientationIcon}>
                          {(v as any).orientation === "portrait" ? <Smartphone size={12} /> : <Monitor size={12} />}
                        </span>
                      )}
                    </span>
                    {v.description && <span className={styles.existingItemDesc}>{v.description}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.existingEmpty}>
                No existing {isTactical ? "videos" : "drills"}{skill ? ` for ${formatLabel(skill)}` : ""}. Upload a new one above.
              </p>
            )}
          </div>

          {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={isUploading} type="button">Cancel</button>
          {isUploadMode && (
            <button className={styles.confirmBtn} onClick={handleUploadAndAdd} disabled={!canUpload || uploading} type="button">
              {uploading ? "Uploading..." : confirmUploadLabel}
            </button>
          )}
          {isExistingMode && (
            <button className={styles.confirmBtn} onClick={handleAddExisting} disabled={!canAddExisting} type="button">
              {confirmExistingLabel}
            </button>
          )}
          {!isUploadMode && !isExistingMode && (
            <button className={styles.confirmBtn} disabled type="button">
              {isEditMode ? "Select a drill" : confirmExistingLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
