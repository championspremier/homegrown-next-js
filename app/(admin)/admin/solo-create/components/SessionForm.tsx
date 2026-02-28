"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ArrowLeft, Plus, Save, ChevronDown, Trash2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import DrillItem from "./DrillItem";
import AddDrillModal from "./AddDrillModal";
import {
  getSkillsForCategory,
  getTechnicalSkillsForPeriod,
  PHYSICAL_SKILLS,
  MENTAL_SKILLS,
  MENTAL_EXERCISE_SKILLS,
  PHYSICAL_SUB_SKILLS,
  formatLabel,
} from "@/lib/curriculum";
import styles from "../solo-create.module.css";
import type { Category, SoloSession, SoloVideo } from "../solo-create-client";
import type { DrillData } from "./DrillItem";

const TACTICAL_PHASES = [
  { value: "attacking", label: "Attacking" },
  { value: "defending", label: "Defending" },
  { value: "transition-a-to-d", label: "Transition A\u2192D" },
  { value: "transition-d-to-a", label: "Transition D\u2192A" },
];

interface Props {
  category: Category;
  videos: SoloVideo[];
  editSession?: SoloSession | null;
  onBack: () => void;
  onVideoUploaded: (video: SoloVideo) => void;
  onSessionSaved?: (session: SoloSession) => void;
}

const TACTICAL_PERIODS = ["build-out", "middle-third", "final-third", "wide-play"];
const TACTICAL_PERIODS_WITH_ALL = ["all", ...TACTICAL_PERIODS];
const PHYSICAL_SEASONS = ["in-season", "off-season"];
const DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"];

type DrillSection = "warmup" | "main" | "finishing";

interface PhysicalSet {
  drills: DrillData[];
  collapsed: boolean;
}

interface ModalContext {
  mode: "add" | "edit";
  section?: DrillSection;
  setIndex?: number;
  drillIndex?: number;
  editDrill?: DrillData;
}

function exerciseToDrill(ex: SoloSession["main_exercises"][number]): DrillData {
  return {
    video_id: ex.video_id,
    name: ex.name,
    path: ex.path,
    section: ex.section,
    skill: ex.skill,
    sub_skill: ex.sub_skill,
    coaching_points: ex.coaching_points,
    rest_time: ex.rest_time,
    reps: ex.reps,
    sets: ex.sets,
    set_number: ex.set_number,
  };
}

function buildPhysicalSets(exercises: SoloSession["main_exercises"]): PhysicalSet[] {
  const map = new Map<number, DrillData[]>();
  for (const ex of exercises) {
    const setNum = ex.set_number ?? 1;
    if (!map.has(setNum)) map.set(setNum, []);
    map.get(setNum)!.push(exerciseToDrill(ex));
  }
  const sorted = [...map.entries()].sort((a, b) => a[0] - b[0]);
  if (sorted.length === 0) return [{ drills: [], collapsed: false }];
  return sorted.map(([, drills]) => ({ drills, collapsed: false }));
}

function reorder<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}

export default function SessionForm({ category, videos, editSession, onBack, onVideoUploaded, onSessionSaved }: Props) {
  const isEditing = !!editSession;
  const isPhysical = category === "physical";
  const isTactical = category === "tactical";
  const isMental = category === "mental";
  const isTechnical = category === "technical";

  const periodOptions = isPhysical
    ? PHYSICAL_SEASONS
    : isTactical
      ? TACTICAL_PERIODS_WITH_ALL
      : TACTICAL_PERIODS;

  const showPeriodDropdown = !isMental;
  const showDifficulty = !isTactical;

  const [period, setPeriod] = useState(
    isEditing ? editSession.period : (isMental ? "all" : periodOptions[0])
  );
  const [difficulty, setDifficulty] = useState(
    isEditing ? editSession.difficulty_level : DIFFICULTY_LEVELS[0]
  );
  const [title, setTitle] = useState(isEditing ? (editSession.title || "") : "");

  const [warmupDrills, setWarmupDrills] = useState<DrillData[]>(() => {
    if (!isEditing || !isTechnical) return [];
    const exercises = editSession.main_exercises || [];
    // New format: drills tagged with section="warmup"
    const tagged = exercises.filter((ex) => ex.section === "warmup");
    if (tagged.length > 0) return tagged.map(exerciseToDrill);
    // Legacy fallback: single warm_up_video_id
    if (!editSession.warm_up_video_id) return [];
    const fromExercises = exercises.find((ex) => ex.video_id === editSession.warm_up_video_id);
    if (fromExercises) return [exerciseToDrill(fromExercises)];
    const fromVideos = videos.find((v) => v.id === editSession.warm_up_video_id);
    if (fromVideos) {
      return [{
        video_id: fromVideos.id,
        name: fromVideos.title || "Warm-Up",
        path: fromVideos.video_url,
        skill: fromVideos.skill || undefined,
        sub_skill: fromVideos.sub_skill || undefined,
      }];
    }
    return [];
  });

  const [mainDrills, setMainDrills] = useState<DrillData[]>(() => {
    if (!isEditing || !isTechnical) return [];
    const exercises = editSession.main_exercises || [];
    const hasSectionTags = exercises.some((ex) => ex.section);
    if (hasSectionTags) {
      // New format: drills tagged with section="main" (or no section tag defaults to main)
      return exercises.filter((ex) => ex.section === "main" || !ex.section).map(exerciseToDrill);
    }
    // Legacy fallback: exclude warm-up and finishing video IDs
    const skipIds = new Set<string>();
    if (editSession.warm_up_video_id) skipIds.add(editSession.warm_up_video_id);
    if (editSession.finishing_or_passing_video_id) skipIds.add(editSession.finishing_or_passing_video_id);
    return exercises.filter((ex) => !skipIds.has(ex.video_id)).map(exerciseToDrill);
  });

  const [finishingDrills, setFinishingDrills] = useState<DrillData[]>(() => {
    if (!isEditing || !isTechnical) return [];
    const exercises = editSession.main_exercises || [];
    // New format: drills tagged with section="finishing"
    const tagged = exercises.filter((ex) => ex.section === "finishing");
    if (tagged.length > 0) return tagged.map(exerciseToDrill);
    // Legacy fallback: single finishing_or_passing_video_id
    if (!editSession.finishing_or_passing_video_id) return [];
    const fromExercises = exercises.find((ex) => ex.video_id === editSession.finishing_or_passing_video_id);
    if (fromExercises) return [exerciseToDrill(fromExercises)];
    const fromVideos = videos.find((v) => v.id === editSession.finishing_or_passing_video_id);
    if (fromVideos) {
      return [{
        video_id: fromVideos.id,
        name: fromVideos.title || "Finishing",
        path: fromVideos.video_url,
        skill: fromVideos.skill || undefined,
        sub_skill: fromVideos.sub_skill || undefined,
      }];
    }
    return [];
  });

  const [physicalSkill, setPhysicalSkill] = useState(
    isEditing && isPhysical ? (editSession.skill || "") : ""
  );
  const [physicalSubSkill, setPhysicalSubSkill] = useState(
    isEditing && isPhysical ? (editSession.sub_skill || "") : ""
  );
  const [physicalSets, setPhysicalSets] = useState<PhysicalSet[]>(() => {
    if (!isEditing || !isPhysical) return [{ drills: [], collapsed: false }];
    return buildPhysicalSets(editSession.main_exercises || []);
  });

  const [flatDrills, setFlatDrills] = useState<DrillData[]>(() => {
    if (!isEditing || (!isTactical && !isMental)) return [];
    return (editSession.main_exercises || []).map(exerciseToDrill);
  });
  const [mentalSkill, setMentalSkill] = useState(
    isEditing && isMental ? (editSession.skill || "") : ""
  );

  // Tactical: phase + technical skill tags
  const [tacticalPhase, setTacticalPhase] = useState(
    isEditing && isTactical ? ((editSession.main_exercises?.[0] as any)?.phase || "") : ""
  );
  const [tacticalTaggedSkills, setTacticalTaggedSkills] = useState<string[]>(
    isEditing && isTactical ? ((editSession.main_exercises?.[0] as any)?.tagged_skills || []) : []
  );
  const [sessionNotes, setSessionNotes] = useState(
    isEditing ? ((editSession as any).description || "") : ""
  );

  // Refs keep the latest drill state accessible to buildPayload at all times,
  // even if called before React has flushed a pending state update.
  const warmupDrillsRef = useRef(warmupDrills);
  const mainDrillsRef = useRef(mainDrills);
  const finishingDrillsRef = useRef(finishingDrills);
  const flatDrillsRef = useRef(flatDrills);
  const physicalSetsRef = useRef(physicalSets);
  useEffect(() => { warmupDrillsRef.current = warmupDrills; }, [warmupDrills]);
  useEffect(() => { mainDrillsRef.current = mainDrills; }, [mainDrills]);
  useEffect(() => { finishingDrillsRef.current = finishingDrills; }, [finishingDrills]);
  useEffect(() => { flatDrillsRef.current = flatDrills; }, [flatDrills]);
  useEffect(() => { physicalSetsRef.current = physicalSets; }, [physicalSets]);

  const tacticalSkillOptions = useMemo(
    () => (isTactical ? getTechnicalSkillsForPeriod(period) : []),
    [isTactical, period]
  );

  function toggleTacticalTag(skill: string) {
    setTacticalTaggedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [modalCtx, setModalCtx] = useState<ModalContext>({ mode: "add", section: "main" });
  const [saving, setSaving] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // --- Curriculum enforcement for Technical ---
  const allowedTechnicalSkills = useMemo(
    () => (isTechnical ? getSkillsForCategory("technical", period) : []),
    [isTechnical, period]
  );
  const allowedSkillSet = useMemo(() => new Set(allowedTechnicalSkills), [allowedTechnicalSkills]);

  const allTechnicalDrills = useMemo(
    () => [...warmupDrills, ...mainDrills, ...finishingDrills],
    [warmupDrills, mainDrills, finishingDrills]
  );

  const conflictingDrills = useMemo(() => {
    if (!isTechnical) return [];
    return allTechnicalDrills.filter((d) => d.skill && !allowedSkillSet.has(d.skill));
  }, [isTechnical, allTechnicalDrills, allowedSkillSet]);

  const conflictingSkills = useMemo(
    () => [...new Set(conflictingDrills.map((d) => d.skill!))],
    [conflictingDrills]
  );

  const derivedTechnicalSkill = useMemo(() => {
    if (!isTechnical) return null;
    const first = mainDrills[0] || warmupDrills[0] || finishingDrills[0];
    return first?.skill || null;
  }, [isTechnical, mainDrills, warmupDrills, finishingDrills]);

  // Physical sub-skills (e.g. Speed → Lateral / Linear)
  const physicalSubSkillOptions = useMemo(() => {
    if (isPhysical && physicalSkill) return PHYSICAL_SUB_SKILLS[physicalSkill] || [];
    return [];
  }, [isPhysical, physicalSkill]);

  // --- Modal open helpers ---
  function openAddModal(section: DrillSection) {
    setModalCtx({ mode: "add", section });
    setModalOpen(true);
  }

  function openAddFlatModal() {
    setModalCtx({ mode: "add" });
    setModalOpen(true);
  }

  function openAddPhysicalModal(setIndex: number) {
    setModalCtx({ mode: "add", setIndex });
    setModalOpen(true);
  }

  function openEditModal(drill: DrillData, section?: DrillSection, drillIndex?: number, setIndex?: number) {
    setModalCtx({ mode: "edit", section, drillIndex, setIndex, editDrill: drill });
    setModalOpen(true);
  }

  function handleModalResult(drill: DrillData) {
    console.log("[handleModalResult]", { mode: modalCtx.mode, section: modalCtx.section, drillIndex: modalCtx.drillIndex, videoId: drill.video_id, name: drill.name });
    if (modalCtx.mode === "edit" && modalCtx.drillIndex !== undefined) {
      replaceDrill(drill);
    } else {
      addDrill(drill);
    }
  }

  function addDrill(drill: DrillData) {
    console.log("[addDrill]", { category, section: modalCtx.section, setIndex: modalCtx.setIndex, videoId: drill.video_id });

    if (isPhysical && modalCtx.setIndex !== undefined) {
      setPhysicalSets((prev) =>
        prev.map((s, i) =>
          i === modalCtx.setIndex
            ? { ...s, drills: [...s.drills, { ...drill, set_number: modalCtx.setIndex! + 1 }] }
            : s
        )
      );
    } else if (isTactical) {
      const enriched = { ...drill, phase: tacticalPhase || null, tagged_skills: tacticalTaggedSkills.length > 0 ? tacticalTaggedSkills : null };
      setFlatDrills((prev) => [...prev, enriched]);
    } else if (isMental) {
      setFlatDrills((prev) => [...prev, drill]);
    } else if (modalCtx.section === "warmup") {
      setWarmupDrills((prev) => {
        const next = [...prev, drill];
        console.log("[addDrill] warmupDrills:", prev.length, "→", next.length);
        return next;
      });
    } else if (modalCtx.section === "main") {
      setMainDrills((prev) => {
        const next = [...prev, drill];
        console.log("[addDrill] mainDrills:", prev.length, "→", next.length);
        return next;
      });
    } else if (modalCtx.section === "finishing") {
      setFinishingDrills((prev) => {
        const next = [...prev, drill];
        console.log("[addDrill] finishingDrills:", prev.length, "→", next.length);
        return next;
      });
    }
  }

  function replaceDrill(drill: DrillData) {
    const idx = modalCtx.drillIndex!;
    if (isPhysical && modalCtx.setIndex !== undefined) {
      setPhysicalSets((prev) =>
        prev.map((s, si) =>
          si === modalCtx.setIndex
            ? { ...s, drills: s.drills.map((d, di) => (di === idx ? { ...drill, set_number: modalCtx.setIndex! + 1 } : d)) }
            : s
        )
      );
    } else if (isTactical || isMental) {
      setFlatDrills((prev) => prev.map((d, i) => (i === idx ? drill : d)));
    } else {
      const updater = (prev: DrillData[]) => prev.map((d, i) => (i === idx ? drill : d));
      if (modalCtx.section === "warmup") setWarmupDrills(updater);
      else if (modalCtx.section === "main") setMainDrills(updater);
      else setFinishingDrills(updater);
    }
  }

  function removeSectionDrill(section: DrillSection, index: number) {
    if (section === "warmup") setWarmupDrills((prev) => prev.filter((_, i) => i !== index));
    else if (section === "main") setMainDrills((prev) => prev.filter((_, i) => i !== index));
    else setFinishingDrills((prev) => prev.filter((_, i) => i !== index));
  }

  function removeFlatDrill(index: number) {
    setFlatDrills((prev) => prev.filter((_, i) => i !== index));
  }

  function removePhysicalDrill(setIndex: number, drillIndex: number) {
    setPhysicalSets((prev) =>
      prev.map((s, i) =>
        i === setIndex ? { ...s, drills: s.drills.filter((_, di) => di !== drillIndex) } : s
      )
    );
  }

  function updateSectionParam(section: DrillSection, index: number, field: string, value: number | null) {
    const updater = (prev: DrillData[]) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d));
    if (section === "warmup") setWarmupDrills(updater);
    else if (section === "main") setMainDrills(updater);
    else setFinishingDrills(updater);
  }

  function updateFlatParam(index: number, field: string, value: number | null) {
    setFlatDrills((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  }

  function updatePhysicalParam(setIndex: number, drillIndex: number, field: string, value: number | null) {
    setPhysicalSets((prev) =>
      prev.map((s, i) =>
        i === setIndex
          ? { ...s, drills: s.drills.map((d, di) => (di === drillIndex ? { ...d, [field]: value } : d)) }
          : s
      )
    );
  }

  function duplicateSectionDrill(section: DrillSection, index: number) {
    const updater = (prev: DrillData[]) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, { ...prev[index] });
      return copy;
    };
    if (section === "main") setMainDrills(updater);
  }

  function duplicateFlatDrill(index: number) {
    setFlatDrills((prev) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, { ...prev[index] });
      return copy;
    });
  }

  function duplicatePhysicalDrill(setIndex: number, drillIndex: number) {
    setPhysicalSets((prev) =>
      prev.map((s, i) => {
        if (i !== setIndex) return s;
        const copy = [...s.drills];
        copy.splice(drillIndex + 1, 0, { ...s.drills[drillIndex] });
        return { ...s, drills: copy };
      })
    );
  }

  const handleDragStart = useCallback((idx: number) => {
    setDragFrom(idx);
    setDragOverIdx(null);
  }, []);

  const handleDragOver = useCallback((_e: React.DragEvent, idx: number) => {
    setDragOverIdx(idx);
  }, []);

  function handleDropMain(toIdx: number) {
    if (dragFrom !== null && dragFrom !== toIdx) setMainDrills((prev) => reorder(prev, dragFrom, toIdx));
    setDragFrom(null);
    setDragOverIdx(null);
  }

  function handleDropFlat(toIdx: number) {
    if (dragFrom !== null && dragFrom !== toIdx) setFlatDrills((prev) => reorder(prev, dragFrom, toIdx));
    setDragFrom(null);
    setDragOverIdx(null);
  }

  function handleDropPhysical(setIndex: number, toIdx: number) {
    if (dragFrom !== null && dragFrom !== toIdx) {
      setPhysicalSets((prev) =>
        prev.map((s, i) => (i === setIndex ? { ...s, drills: reorder(s.drills, dragFrom, toIdx) } : s))
      );
    }
    setDragFrom(null);
    setDragOverIdx(null);
  }

  function toggleSetCollapse(setIndex: number) {
    setPhysicalSets((prev) =>
      prev.map((s, i) => (i === setIndex ? { ...s, collapsed: !s.collapsed } : s))
    );
  }

  function addSet() {
    setPhysicalSets((prev) => [...prev, { drills: [], collapsed: false }]);
  }

  function removeSet(setIndex: number) {
    const target = physicalSets[setIndex];
    if (target.drills.length > 0 && !confirm(`Remove Set ${setIndex + 1} with ${target.drills.length} drill(s)?`)) return;
    setPhysicalSets((prev) => prev.filter((_, i) => i !== setIndex));
  }

  function shouldHideParams(drill: DrillData): boolean {
    if (isTactical) return true;
    if (isMental) return !MENTAL_EXERCISE_SKILLS.has(drill.skill || "");
    return false;
  }

  function buildPayload() {
    const curWarmup = warmupDrillsRef.current;
    const curMain = mainDrillsRef.current;
    const curFinishing = finishingDrillsRef.current;
    const curFlat = flatDrillsRef.current;
    const curPhySets = physicalSetsRef.current;

    console.log("[buildPayload]", { category, warmup: curWarmup.length, main: curMain.length, finishing: curFinishing.length, flat: curFlat.length });

    let allExercises: (DrillData & { section?: string })[] = [];
    let warmUpVideoId: string | null = null;
    let finishingVideoId: string | null = null;
    let skillValue: string | null = null;
    let subSkillValue: string | null = null;
    let difficultyValue = difficulty;

    if (isTechnical) {
      // Combine all three sections into one array, tagged with section
      allExercises = [
        ...curWarmup.map((d) => ({ ...d, section: "warmup" as const })),
        ...curMain.map((d) => ({ ...d, section: "main" as const })),
        ...curFinishing.map((d) => ({ ...d, section: "finishing" as const })),
      ];
      // Backward-compat: first warmup/finishing drill ID in dedicated columns
      warmUpVideoId = curWarmup[0]?.video_id || null;
      finishingVideoId = curFinishing[0]?.video_id || null;
      const first = curMain[0] || curWarmup[0] || curFinishing[0];
      skillValue = first?.skill || null;
      console.log("[buildPayload] technical:", { warmUpVideoId, finishingVideoId, totalDrills: allExercises.length, skill: skillValue });
    } else if (isPhysical) {
      skillValue = physicalSkill || null;
      subSkillValue = physicalSubSkill || null;
      allExercises = curPhySets.flatMap((set, setIdx) =>
        set.drills.map((d) => ({ ...d, set_number: setIdx + 1 }))
      );
    } else if (isTactical) {
      difficultyValue = "beginner";
      allExercises = curFlat.map((d, i) => ({
        ...d,
        order: i + 1,
        phase: (d as any).phase || tacticalPhase || null,
        tagged_skills: (d as any).tagged_skills || (tacticalTaggedSkills.length > 0 ? tacticalTaggedSkills : null),
      }));
    } else if (isMental) {
      skillValue = mentalSkill || null;
      allExercises = curFlat;
    }

    const result: Record<string, unknown> = {
      category,
      period,
      skill: skillValue,
      sub_skill: subSkillValue,
      difficulty_level: difficultyValue,
      title: title.trim() || null,
      description: sessionNotes.trim() || null,
      warm_up_video_id: warmUpVideoId,
      finishing_or_passing_video_id: finishingVideoId,
      main_exercises: allExercises.map((d, i) => ({
        video_id: d.video_id,
        name: d.name,
        path: d.path,
        section: d.section || null,
        skill: d.skill || null,
        sub_skill: d.sub_skill || null,
        coaching_points: d.coaching_points || null,
        rest_time: d.rest_time ?? null,
        reps: d.reps ?? null,
        sets: d.sets ?? null,
        set_number: d.set_number ?? null,
        order: (d as any).order ?? i + 1,
        phase: (d as any).phase || null,
        tagged_skills: (d as any).tagged_skills || null,
      })),
      is_active: true,
    };

    return result;
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const payload = buildPayload();

    console.log("[handleSave]", {
      isEditing,
      sessionId: editSession?.id,
      warmUp: payload.warm_up_video_id,
      finishing: payload.finishing_or_passing_video_id,
      mainCount: (payload.main_exercises as unknown[])?.length,
    });
    console.log("[handleSave] payload:", JSON.stringify(payload, null, 2));

    try {
      if (isEditing && editSession) {
        if (!editSession.id) {
          console.error("Cannot update: editSession.id is missing!", editSession);
          alert("Update failed: session ID is missing.");
          setSaving(false);
          return;
        }

        const { data, error } = await (supabase as any)
          .from("solo_sessions")
          .update(payload)
          .eq("id", editSession.id)
          .select("*")
          .single();

        console.log("[handleSave] UPDATE result:", { data: !!data, error });

        if (error) {
          console.error("Update failed:", error);
          alert("Failed to update session: " + error.message);
          setSaving(false);
          return;
        }
        if (!data) {
          console.error("Update returned no data — session may not exist or RLS blocked it");
          alert("Update failed: no data returned. The session may not exist or you may not have permission to update it.");
          setSaving(false);
          return;
        }

        // Verify the update persisted correctly
        const { data: verified, error: verifyErr } = await (supabase as any)
          .from("solo_sessions")
          .select("*")
          .eq("id", editSession.id)
          .single();

        if (verifyErr) {
          console.warn("[verify] failed:", verifyErr);
        } else {
          console.log("[verify] saved session:", {
            mainCount: verified.main_exercises?.length,
            warmUp: verified.warm_up_video_id,
            finishing: verified.finishing_or_passing_video_id,
          });
        }

        onSessionSaved?.(data);
      } else {
        const { data, error } = await (supabase as any)
          .from("solo_sessions")
          .insert(payload)
          .select("*")
          .single();

        console.log("[handleSave] INSERT result:", { data: !!data, error });

        if (error) {
          console.error("Insert failed:", error);
          alert("Failed to create session: " + error.message);
          setSaving(false);
          return;
        }
        if (!data) {
          console.error("Insert returned no data");
          alert("Create failed: no data returned. Check permissions.");
          setSaving(false);
          return;
        }

        onSessionSaved?.(data);
      }
    } catch (err: unknown) {
      console.error("Save exception:", err);
      alert(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);

  function renderSectionDrills(drills: DrillData[], section: DrillSection, singleSlot: boolean) {
    return drills.map((drill, i) => (
      <DrillItem
        key={`${section}-${i}-${drill.video_id}`}
        drill={drill}
        index={i}
        singleSlot={singleSlot}
        hideParams={shouldHideParams(drill)}
        onRemove={() => removeSectionDrill(section, i)}
        onParamChange={(field, value) => updateSectionParam(section, i, field, value)}
        onEdit={() => openEditModal(drill, section, i)}
        onDuplicate={singleSlot ? undefined : () => duplicateSectionDrill(section, i)}
        onDragStart={singleSlot ? undefined : handleDragStart}
        onDragOver={singleSlot ? undefined : handleDragOver}
        onDrop={singleSlot ? undefined : handleDropMain}
        dragOverIndex={singleSlot ? null : dragOverIdx}
      />
    ));
  }

  return (
    <div className={styles.sessionForm}>
      <div className={styles.formTopBar}>
        <button className={styles.backBtn} onClick={onBack} type="button">
          <ArrowLeft size={16} /> Back
        </button>
        <h2 className={styles.formHeading}>
          {isEditing ? `Edit ${categoryLabel} Session` : `New ${categoryLabel} Session`}
        </h2>
        <button className={styles.confirmBtn} type="button" onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? "Saving..." : (isEditing ? "Update Session" : "Save Session")}
        </button>
      </div>

      <div className={styles.formMeta}>
        <label className={styles.fieldLabel}>
          Title
          <input
            className={styles.fieldInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`${categoryLabel} session title`}
          />
        </label>

        <div className={styles.metaRow}>
          {showPeriodDropdown ? (
            <label className={styles.fieldLabel}>
              {isPhysical ? "Season" : "Period"}
              <select className={styles.fieldSelect} value={period} onChange={(e) => setPeriod(e.target.value)}>
                {periodOptions.map((p) => (
                  <option key={p} value={p}>{formatLabel(p)}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className={styles.fieldLabel}>
              <span>Period</span>
              <span className={styles.staticValue}>All Periods</span>
            </div>
          )}

          {showDifficulty ? (
            <label className={styles.fieldLabel}>
              Difficulty
              <select className={styles.fieldSelect} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {DIFFICULTY_LEVELS.map((d) => (
                  <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
            </label>
          ) : (
            <div />
          )}
        </div>

        {isTechnical && (
          <div className={styles.curriculumInfo}>
            <span className={styles.availableSkillsLabel}>
              Available Skills for {formatLabel(period)}
            </span>
            <div className={styles.availableSkillsPills}>
              {allowedTechnicalSkills.map((s) => (
                <span key={s} className={styles.availableSkillPill}>{formatLabel(s)}</span>
              ))}
            </div>
            <span className={styles.sessionSkillInfo}>
              Session Skill: {derivedTechnicalSkill ? formatLabel(derivedTechnicalSkill) : "set by first drill"}
            </span>
          </div>
        )}

        {isTechnical && conflictingDrills.length > 0 && (
          <div className={styles.curriculumWarning}>
            <AlertTriangle size={16} />
            <span>
              {conflictingDrills.length} drill{conflictingDrills.length !== 1 ? "s have" : " has"} skills
              not available in {formatLabel(period)}: <strong>{conflictingSkills.map(formatLabel).join(", ")}</strong>.
              Remove them or change the period back.
            </span>
          </div>
        )}

        {isTactical && (
          <>
            <div className={styles.phaseSection}>
              <span className={styles.fieldLabel}>Phase</span>
              <div className={styles.skillPills}>
                {TACTICAL_PHASES.map((p) => (
                  <button
                    key={p.value}
                    className={`${styles.skillPill} ${tacticalPhase === p.value ? styles.skillPillActive : ""}`}
                    onClick={() => setTacticalPhase(tacticalPhase === p.value ? "" : p.value)}
                    type="button"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.tacticalTagsSection}>
              <span className={styles.fieldLabel}>Technical Skills Covered (optional)</span>
              <div className={styles.skillPills}>
                {tacticalSkillOptions.map((s) => (
                  <button
                    key={s}
                    className={`${styles.tacticalTagPill} ${tacticalTaggedSkills.includes(s) ? styles.tacticalTagPillActive : ""}`}
                    onClick={() => toggleTacticalTag(s)}
                    type="button"
                  >
                    {formatLabel(s)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {isPhysical && (
          <>
            <div className={styles.skillFilterSection}>
              <span className={styles.fieldLabel}>Skill</span>
              <div className={styles.skillPills}>
                {PHYSICAL_SKILLS.map((s) => (
                  <button
                    key={s}
                    className={`${styles.skillPill} ${physicalSkill === s ? styles.skillPillActive : ""}`}
                    onClick={() => { setPhysicalSkill(physicalSkill === s ? "" : s); setPhysicalSubSkill(""); }}
                    type="button"
                  >
                    {formatLabel(s)}
                  </button>
                ))}
              </div>
            </div>
            {physicalSubSkillOptions.length > 0 && (
              <div className={styles.skillFilterSection}>
                <span className={styles.fieldLabel}>Sub-Skill</span>
                <div className={styles.skillPills}>
                  {physicalSubSkillOptions.map((ss) => (
                    <button
                      key={ss}
                      className={`${styles.skillPill} ${physicalSubSkill === ss ? styles.skillPillActive : ""}`}
                      onClick={() => setPhysicalSubSkill(physicalSubSkill === ss ? "" : ss)}
                      type="button"
                    >
                      {formatLabel(ss)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {isMental && (
          <div className={styles.skillFilterSection}>
            <span className={styles.fieldLabel}>Skill</span>
            <div className={styles.skillPills}>
              {MENTAL_SKILLS.map((s) => (
                <button
                  key={s}
                  className={`${styles.skillPill} ${mentalSkill === s ? styles.skillPillActive : ""}`}
                  onClick={() => setMentalSkill(mentalSkill === s ? "" : s)}
                  type="button"
                >
                  {formatLabel(s)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isTechnical && (
        <>
          <div className={styles.drillSection}>
            <div className={styles.drillSectionHeader}>
              <h3 className={styles.drillSectionTitle}>Warm-Up</h3>
              <button className={styles.addDrillBtn} onClick={() => openAddModal("warmup")} type="button">
                <Plus size={16} /> Add Drill
              </button>
            </div>
            {warmupDrills.length === 0 && <p className={styles.drillEmpty}>No warm-up drills added yet.</p>}
            {renderSectionDrills(warmupDrills, "warmup", true)}
          </div>

          <div className={styles.drillSection}>
            <div className={styles.drillSectionHeader}>
              <h3 className={styles.drillSectionTitle}>Main Exercises</h3>
              <button className={styles.addDrillBtn} onClick={() => openAddModal("main")} type="button">
                <Plus size={16} /> Add Drill
              </button>
            </div>
            {mainDrills.length === 0 && <p className={styles.drillEmpty}>No main exercises added yet.</p>}
            {renderSectionDrills(mainDrills, "main", false)}
          </div>

          <div className={styles.drillSection}>
            <div className={styles.drillSectionHeader}>
              <h3 className={styles.drillSectionTitle}>Finishing / Passing</h3>
              <button className={styles.addDrillBtn} onClick={() => openAddModal("finishing")} type="button">
                <Plus size={16} /> Add Drill
              </button>
            </div>
            {finishingDrills.length === 0 && <p className={styles.drillEmpty}>No finishing drills added yet.</p>}
            {renderSectionDrills(finishingDrills, "finishing", true)}
          </div>
        </>
      )}

      {isPhysical && (
        <>
          {physicalSets.map((set, setIdx) => (
            <div key={setIdx} className={styles.drillSection}>
              <div className={styles.setHeader} onClick={() => toggleSetCollapse(setIdx)}>
                <div className={styles.setHeaderLeft}>
                  <ChevronDown size={18} className={`${styles.setChevron} ${set.collapsed ? "" : styles.setChevronOpen}`} />
                  <h3 className={styles.drillSectionTitle}>
                    Set {setIdx + 1}
                    {set.drills.length > 0 && (
                      <span className={styles.setDrillCount}>{set.drills.length} drill{set.drills.length !== 1 ? "s" : ""}</span>
                    )}
                  </h3>
                </div>
                <div className={styles.setActions}>
                  <button className={styles.addDrillBtn} onClick={(e) => { e.stopPropagation(); openAddPhysicalModal(setIdx); }} type="button">
                    <Plus size={16} /> Add Drill
                  </button>
                  {physicalSets.length > 1 && (
                    <button className={styles.removeSetBtn} onClick={(e) => { e.stopPropagation(); removeSet(setIdx); }} type="button" aria-label={`Remove Set ${setIdx + 1}`}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
              {!set.collapsed && (
                <div className={styles.setBody}>
                  {set.drills.length === 0 && <p className={styles.drillEmpty}>No drills in this set yet.</p>}
                  {set.drills.map((drill, di) => (
                    <DrillItem
                      key={`set${setIdx}-${di}-${drill.video_id}`}
                      drill={drill}
                      index={di}
                      onRemove={() => removePhysicalDrill(setIdx, di)}
                      onParamChange={(field, value) => updatePhysicalParam(setIdx, di, field, value)}
                      onEdit={() => openEditModal(drill, undefined, di, setIdx)}
                      onDuplicate={() => duplicatePhysicalDrill(setIdx, di)}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={(toIdx) => handleDropPhysical(setIdx, toIdx)}
                      dragOverIndex={dragOverIdx}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          <button className={styles.addSetBtn} onClick={addSet} type="button">
            <Plus size={16} /> Add Set
          </button>
        </>
      )}

      {isTactical && (
        <>
          <div className={styles.drillSection}>
            <div className={styles.drillSectionHeader}>
              <div>
                <h3 className={styles.drillSectionTitle}>Videos</h3>
                <p className={styles.sectionNote}>Tactical videos should be at least 1 minute</p>
              </div>
              <button className={styles.addDrillBtn} onClick={openAddFlatModal} type="button">
                <Plus size={16} /> Add Video
              </button>
            </div>
            {flatDrills.length === 0 && <p className={styles.drillEmpty}>No videos added yet.</p>}
            {flatDrills.map((drill, i) => (
              <DrillItem
                key={`tactical-${i}-${drill.video_id}`}
                drill={drill}
                index={i}
                hideParams
                showTacticalMeta
                onRemove={() => removeFlatDrill(i)}
                onParamChange={(field, value) => updateFlatParam(i, field, value)}
                onEdit={() => openEditModal(drill, undefined, i)}
                onDuplicate={() => duplicateFlatDrill(i)}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDropFlat}
                dragOverIndex={dragOverIdx}
              />
            ))}
          </div>
          <div className={`${styles.drillSection} ${styles.sessionNotesArea}`}>
            <label className={styles.fieldLabel}>
              Session Notes (optional)
              <textarea
                className={styles.fieldTextarea}
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Overall session notes, context, or coaching directives..."
                rows={4}
              />
            </label>
          </div>
        </>
      )}

      {isMental && (
        <div className={styles.drillSection}>
          <div className={styles.drillSectionHeader}>
            <h3 className={styles.drillSectionTitle}>Exercises</h3>
            <button className={styles.addDrillBtn} onClick={openAddFlatModal} type="button">
              <Plus size={16} /> Add Drill
            </button>
          </div>
          {flatDrills.length === 0 && <p className={styles.drillEmpty}>No exercises added yet.</p>}
          {flatDrills.map((drill, i) => (
            <DrillItem
              key={`mental-${i}-${drill.video_id}`}
              drill={drill}
              index={i}
              hideParams={shouldHideParams(drill)}
              onRemove={() => removeFlatDrill(i)}
              onParamChange={(field, value) => updateFlatParam(i, field, value)}
              onEdit={() => openEditModal(drill, undefined, i)}
              onDuplicate={() => duplicateFlatDrill(i)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDropFlat}
              dragOverIndex={dragOverIdx}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <AddDrillModal
          category={category}
          period={period}
          physicalSkill={isPhysical ? physicalSkill : undefined}
          mentalSkill={isMental ? mentalSkill : undefined}
          videos={videos}
          editDrill={modalCtx.mode === "edit" ? modalCtx.editDrill : undefined}
          onClose={() => setModalOpen(false)}
          onAdd={handleModalResult}
          onVideoUploaded={onVideoUploaded}
        />
      )}
    </div>
  );
}
