"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Edit3,
  Heart,
  Link2,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import {
  ABILITY_SCORE_KEYS,
  CHARACTER_CONDITIONS,
  EMPTY_EQUIPMENT,
  EQUIPMENT_LABELS,
  extractCharacterSkillCost,
  extractCharacterSkills,
} from "@/features/character/domain";
import { abilityModifier, formatModifier } from "@/components/dice/dice";
import SaoCharacterOrb, {
  DEFAULT_ORB_SCALE_PERCENT,
  MAX_ORB_SCALE_PERCENT,
  MIN_ORB_SCALE_PERCENT,
  ORB_SCALE_STEP_PERCENT,
  SAO_ORB_SCALE_STORAGE_KEY,
  SaoDualSemicircleDial,
  computeEffectiveOrbPx,
  playSaoChime,
} from "./SaoCharacterOrb";
import type { Character, CharacterCombatFormState } from "../types";

type CharacterInspectorPanelProps = {
  activeChar: Character | null | undefined;
  userCharacters: Character[];
  isEditingChar: boolean;
  isSavingChar: boolean;
  isSwitchingChar: boolean;
  charForm: CharacterCombatFormState;
  tableCode: string;
  isHeadTable: boolean;
  onToggleEdit: () => void;
  onStartSwitch: () => void;
  onCancelSwitch: () => void;
  onSelectCharacter: (charId: string) => void;
  onChangeCharForm: (next: CharacterCombatFormState) => void;
  onSaveCharEdits: () => void;
  onCancelEdit: () => void;
};

export default function CharacterInspectorPanel({
  activeChar,
  userCharacters,
  isEditingChar,
  isSavingChar,
  isSwitchingChar,
  charForm,
  tableCode,
  isHeadTable,
  onToggleEdit,
  onStartSwitch,
  onCancelSwitch,
  onSelectCharacter,
  onChangeCharForm,
  onSaveCharEdits,
  onCancelEdit,
}: CharacterInspectorPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [scalePercent, setScalePercent] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_ORB_SCALE_PERCENT;
    try {
      const saved = Number(
        window.localStorage.getItem(SAO_ORB_SCALE_STORAGE_KEY),
      );
      if (
        Number.isFinite(saved) &&
        saved >= MIN_ORB_SCALE_PERCENT &&
        saved <= MAX_ORB_SCALE_PERCENT
      ) {
        return Math.round(saved);
      }
    } catch {
      // Ignore storage access errors
    }
    return DEFAULT_ORB_SCALE_PERCENT;
  });
  const [viewport, setViewport] = useState<{ width: number; height: number }>(
    () => ({
      width: typeof window !== "undefined" ? window.innerWidth : 1440,
      height: typeof window !== "undefined" ? window.innerHeight : 900,
    }),
  );

  const activeSkills = extractCharacterSkills(activeChar);
  const { currentSkillCost, maxSkillCost } =
    extractCharacterSkillCost(activeChar);

  // Track viewport changes for responsive orb & window placement
  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  // Persist user orb scale preference to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SAO_ORB_SCALE_STORAGE_KEY,
        String(scalePercent),
      );
    } catch {
      // Ignore storage errors
    }
  }, [scalePercent]);

  const orbSizePx = computeEffectiveOrbPx(
    scalePercent,
    viewport.width,
    viewport.height,
  );
  const isDesktop = viewport.width >= 1024;

  // Sync dynamic left clearance CSS variable so NarrativeFeedPanel's bottom input never overlaps the orb
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--sao-orb-clearance", `${orbSizePx + 32}px`);
    return () => {
      root.style.removeProperty("--sao-orb-clearance");
    };
  }, [orbSizePx]);

  const handleToggleWindow = () => {
    const next = !isOpen;
    setIsOpen(next);
    playSaoChime(next);
  };

  const handleDecreaseScale = () => {
    setScalePercent((prev) =>
      Math.max(MIN_ORB_SCALE_PERCENT, prev - ORB_SCALE_STEP_PERCENT),
    );
  };

  const handleIncreaseScale = () => {
    setScalePercent((prev) =>
      Math.min(MAX_ORB_SCALE_PERCENT, prev + ORB_SCALE_STEP_PERCENT),
    );
  };

  const handleResetScale = () => {
    setScalePercent(DEFAULT_ORB_SCALE_PERCENT);
  };

  // Allow closing the SAO window with Escape when not actively editing inputs
  useEffect(() => {
    if (!isOpen || isEditingChar) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        playSaoChime(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isEditingChar]);

  const handleCopyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}/table/${tableCode}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const curHp = activeChar?.current_hp ?? 0;
  const maxHp = Math.max(1, activeChar?.max_hp ?? 1);
  const hpPercent = activeChar
    ? Math.max(0, Math.min(100, Math.round((curHp / maxHp) * 100)))
    : 0;
  const spPercent =
    activeChar && maxSkillCost > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((currentSkillCost / maxSkillCost) * 100)),
        )
      : 0;

  // Dynamic placement for the expanded SAO window based on current orb size & viewport
  const desktopLeftPx = Math.min(
    orbSizePx + 36,
    Math.max(16, viewport.width - 432),
  );
  const mobileBottomPx = Math.min(
    orbSizePx + 48,
    Math.max(80, Math.round(viewport.height * 0.42)),
  );
  const windowStyle = isDesktop
    ? {
        left: `${desktopLeftPx}px`,
        bottom: "16px",
        maxHeight: "calc(100vh - 3.5rem)",
      }
    : {
        left: "12px",
        bottom: `${mobileBottomPx}px`,
        maxHeight: `calc(100vh - ${mobileBottomPx + 56}px)`,
      };

  return (
    <>
      {/* TOP-LEFT COMPACT NAVIGATION BAR (Always accessible when character panel is collapsed) */}
      <div className="fixed top-3.5 left-4 z-30 flex items-center gap-2 rounded-full bg-zinc-950/90 border border-zinc-800/90 px-3 py-1.5 shadow-xl backdrop-blur-md">
        <Link
          href="/hub"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-amber-400 transition pr-2 border-r border-zinc-800"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden sm:inline">Hub</span>
        </Link>
        <span className="text-[10px] font-mono text-zinc-400 tracking-wider">
          CODE: <strong className="text-amber-400">{tableCode}</strong>
        </span>
        <button
          type="button"
          onClick={handleCopyInviteLink}
          title="Copy Invite Link"
          className="inline-flex items-center gap-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 px-2 py-0.5 text-[10px] font-mono text-zinc-300 hover:text-amber-300 transition cursor-pointer"
        >
          {copiedInvite ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Link2 className="w-3 h-3 text-amber-500" />
              <span>Invite</span>
            </>
          )}
        </button>
      </div>

      {/* EXTRACTED RESPONSIVE FLOATING SAO CIRCULAR ORB WITH [ − | 100% | + ] SIZE CONTROLS */}
      <SaoCharacterOrb
        activeChar={activeChar}
        currentSkillCost={currentSkillCost}
        maxSkillCost={maxSkillCost}
        isOpen={isOpen}
        orbSizePx={orbSizePx}
        scalePercent={scalePercent}
        onToggle={handleToggleWindow}
        onDecreaseScale={handleDecreaseScale}
        onIncreaseScale={handleIncreaseScale}
        onResetScale={handleResetScale}
      />

      {/* EXPANDED SAO FLOATING CHARACTER WINDOW (2-Part Semicircle Crest on Top + Full Character Sheet Underneath) */}
      {isOpen && (
        <aside
          aria-label="Character Inspector Window"
          style={windowStyle}
          className="fixed z-40 w-[calc(100vw-1.5rem)] sm:w-104 flex flex-col rounded-sm bg-zinc-950/94 border border-white/25 shadow-[0_16px_50px_rgba(0,0,0,0.92),0_0_28px_rgba(245,158,11,0.2)] backdrop-blur-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-left-3 duration-200"
        >
          {/* SAO Top Glowing Accent Line */}
          <div className="h-1 w-full bg-linear-to-r from-amber-500 via-amber-300 to-white/70 shrink-0" />

          {/* SAO Window Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-linear-to-r from-zinc-900/95 via-zinc-900/80 to-zinc-950/90 border-b border-white/15 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-1.5 h-8 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.8)] shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-amber-400">
                    PLAYER STATUS
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 bg-white/10 text-zinc-300 rounded-xs">
                    {isHeadTable ? "HOST" : "PARTY"}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white truncate">
                  {activeChar ? activeChar.name : "No Character Bound"}
                </h2>
                <p className="text-[11px] text-zinc-400 truncate">
                  {activeChar?.class_archetype ||
                    "Select a character sheet below"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {activeChar && !isSwitchingChar && (
                <>
                  <button
                    type="button"
                    onClick={onToggleEdit}
                    title={
                      isEditingChar ? "Close Editor" : "Edit Character Sheet"
                    }
                    className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition flex items-center gap-1 cursor-pointer ${
                      isEditingChar
                        ? "bg-amber-500/20 border-amber-400 text-amber-300"
                        : "bg-white/5 border-white/15 text-zinc-300 hover:border-amber-400/70 hover:text-amber-300"
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isEditingChar ? "Close" : "Edit"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onStartSwitch}
                    title="Switch Character Sheet"
                    className="px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider bg-white/5 border border-white/15 text-zinc-300 hover:border-white/40 hover:text-white transition flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Switch</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleToggleWindow}
                aria-label="Close window"
                className="p-1.5 rounded bg-white/5 hover:bg-red-500/20 border border-white/15 hover:border-red-400/60 text-zinc-400 hover:text-red-300 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable Window Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {!activeChar || isSwitchingChar ? (
              /* Character Selector */
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-zinc-300 font-medium flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>Select a character for this session:</span>
                  </label>
                  {isSwitchingChar && (
                    <button
                      type="button"
                      onClick={onCancelSwitch}
                      className="text-[10px] font-mono uppercase text-zinc-400 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {userCharacters.map((char) => {
                  const cost = extractCharacterSkillCost(char);
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => onSelectCharacter(char.id)}
                      className="w-full text-left p-3 rounded bg-zinc-900/80 border border-white/15 hover:border-amber-400 hover:bg-amber-950/20 text-xs transition cursor-pointer"
                    >
                      <p className="font-bold text-white">{char.name}</p>
                      <p className="text-zinc-400 font-mono text-[11px] mt-0.5">
                        {char.class_archetype || "Adventurer"} · HP{" "}
                        {char.current_hp}/{char.max_hp} · SP{" "}
                        {cost.currentSkillCost}/{cost.maxSkillCost}
                      </p>
                    </button>
                  );
                })}
                {userCharacters.length === 0 && (
                  <p className="text-xs text-zinc-500 italic">
                    No character sheets found. Create one in the Character Codex
                    first.
                  </p>
                )}
              </div>
            ) : isEditingChar ? (
              /* Inline Character Combat Editor */
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase font-mono">
                      Current HP
                    </label>
                    <input
                      type="number"
                      max={charForm.max_hp}
                      value={charForm.current_hp}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onChangeCharForm({
                          ...charForm,
                          current_hp: Number.isNaN(val)
                            ? 0
                            : Math.min(charForm.max_hp, val),
                        });
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white focus:border-amber-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase font-mono">
                      Max HP
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={charForm.max_hp}
                      onChange={(e) => {
                        const newMax = Number(e.target.value);
                        const clampedMax = Number.isNaN(newMax) ? 1 : newMax;
                        onChangeCharForm({
                          ...charForm,
                          max_hp: clampedMax,
                          current_hp: Math.min(clampedMax, charForm.current_hp),
                        });
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white focus:border-amber-400 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase font-mono">
                      Current Skill Cost
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={charForm.max_skill_cost}
                      value={charForm.current_skill_cost}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const clamped = Number.isNaN(val)
                          ? 0
                          : Math.max(0, Math.min(charForm.max_skill_cost, val));
                        onChangeCharForm({
                          ...charForm,
                          current_skill_cost: clamped,
                          armor_class: clamped,
                        });
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white focus:border-amber-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase font-mono">
                      Max Skill Cost
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={charForm.max_skill_cost}
                      onChange={(e) => {
                        const newMax = Number(e.target.value);
                        const clampedMax = Number.isNaN(newMax)
                          ? 0
                          : Math.max(0, newMax);
                        const nextCur = Math.min(
                          clampedMax,
                          charForm.current_skill_cost,
                        );
                        onChangeCharForm({
                          ...charForm,
                          max_skill_cost: clampedMax,
                          current_skill_cost: nextCur,
                          armor_class: nextCur,
                        });
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white focus:border-amber-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">
                    Condition
                  </label>
                  <select
                    value={charForm.status_condition}
                    onChange={(e) =>
                      onChangeCharForm({
                        ...charForm,
                        status_condition: e.target.value,
                      })
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white mt-0.5 focus:border-amber-400 outline-none"
                  >
                    {CHARACTER_CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stats Editor */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-zinc-400 uppercase font-mono block">
                      Ability Scores
                    </label>
                    <span className="text-[9px] text-zinc-500 font-mono">
                      Allows negative
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {ABILITY_SCORE_KEYS.map((stat) => (
                      <div
                        key={stat}
                        className="bg-zinc-900 border border-zinc-800 rounded p-1 text-center"
                      >
                        <span className="text-[9px] text-zinc-500 uppercase block">
                          {stat}
                        </span>
                        <input
                          type="number"
                          value={charForm.stats[stat] ?? 10}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "" || raw === "-") {
                              onChangeCharForm({
                                ...charForm,
                                stats: { ...charForm.stats, [stat]: raw },
                              });
                              return;
                            }
                            const val = Number(raw);
                            if (!Number.isNaN(val)) {
                              onChangeCharForm({
                                ...charForm,
                                stats: { ...charForm.stats, [stat]: val },
                              });
                            }
                          }}
                          className="w-full bg-transparent text-center font-bold text-xs text-white outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inventory Editor */}
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">
                    Inventory
                  </label>
                  <textarea
                    rows={3}
                    value={charForm.inventory}
                    onChange={(e) =>
                      onChangeCharForm({
                        ...charForm,
                        inventory: e.target.value,
                      })
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-white mt-1 focus:border-amber-400 outline-none"
                  />
                </div>

                {/* Equipment Slots Editor */}
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">
                    Equipment Slots
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {EQUIPMENT_LABELS.map((label, idx) => (
                      <div key={label}>
                        <span className="text-[9px] text-zinc-500 uppercase block">
                          {label}
                        </span>
                        <input
                          type="text"
                          placeholder={`${label}...`}
                          value={
                            (charForm.equipment ?? EMPTY_EQUIPMENT)[idx] || ""
                          }
                          onChange={(e) => {
                            const next = [
                              ...(charForm.equipment ?? EMPTY_EQUIPMENT),
                            ];
                            next[idx] = e.target.value;
                            onChangeCharForm({ ...charForm, equipment: next });
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-[11px] text-white focus:border-amber-400 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skill Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-zinc-400 uppercase font-mono block">
                      Skill
                    </label>
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {(charForm.skills || []).length} slot(s)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(charForm.skills || []).map((skill, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-zinc-900 border border-zinc-800 rounded space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-amber-500 font-mono uppercase">
                            Skill #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextSkills = (charForm.skills || []).filter(
                                (_, i) => i !== idx,
                              );
                              onChangeCharForm({
                                ...charForm,
                                skills: nextSkills,
                              });
                            }}
                            title="Remove skill"
                            className="text-zinc-500 hover:text-red-400 p-0.5 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-400 uppercase font-mono block">
                            Skill Name :
                          </span>
                          <input
                            type="text"
                            placeholder="Skill name..."
                            value={skill.name}
                            onChange={(e) => {
                              const nextSkills = [...(charForm.skills || [])];
                              nextSkills[idx] = {
                                ...nextSkills[idx],
                                name: e.target.value,
                              };
                              onChangeCharForm({
                                ...charForm,
                                skills: nextSkills,
                              });
                            }}
                            className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded p-1 text-[11px] text-white"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-400 uppercase font-mono block">
                            Skill Cost :
                          </span>
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={skill.cost ?? 0}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const nextSkills = [...(charForm.skills || [])];
                              nextSkills[idx] = {
                                ...nextSkills[idx],
                                cost: Number.isNaN(val) ? 0 : Math.max(0, val),
                              };
                              onChangeCharForm({
                                ...charForm,
                                skills: nextSkills,
                              });
                            }}
                            className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded p-1 text-[11px] text-white"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-400 uppercase font-mono block">
                            Description :
                          </span>
                          <input
                            type="text"
                            placeholder="Description..."
                            value={skill.description}
                            onChange={(e) => {
                              const nextSkills = [...(charForm.skills || [])];
                              nextSkills[idx] = {
                                ...nextSkills[idx],
                                description: e.target.value,
                              };
                              onChangeCharForm({
                                ...charForm,
                                skills: nextSkills,
                              });
                            }}
                            className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded p-1 text-[11px] text-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeCharForm({
                        ...charForm,
                        skills: [
                          ...(charForm.skills || []),
                          { name: "", cost: 0, description: "" },
                        ],
                      })
                    }
                    className="w-full py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700 hover:border-amber-500/60 text-amber-400 rounded text-[11px] font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Skill
                  </button>
                </div>
              </div>
            ) : (
              /* ================= SAO FULL CHARACTER SHEET VIEW ================= */
              <div className="space-y-4">
                {/* 1. Top 2-Part Semicircle Crest inside Window */}
                <div className="flex flex-col items-center rounded bg-zinc-900/60 border border-white/10 p-3">
                  <div className="w-52 h-52">
                    <SaoDualSemicircleDial
                      activeChar={activeChar}
                      currentSkillCost={currentSkillCost}
                      maxSkillCost={maxSkillCost}
                      isOpen={true}
                      variant="crest"
                    />
                  </div>

                  {/* SAO Linear HP & Skill Point Gauge Bars right beneath the dial */}
                  <div className="w-full grid grid-cols-2 gap-3 mt-2 pt-2.5 border-t border-white/10">
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                        <span className="flex items-center gap-1 text-zinc-300">
                          <Heart className="w-3 h-3 text-emerald-400" /> HP
                        </span>
                        <span className="text-white font-bold">
                          {activeChar.current_hp} / {activeChar.max_hp}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-zinc-950 border border-white/15 rounded-xs overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            hpPercent <= 25
                              ? "bg-red-500"
                              : hpPercent <= 55
                                ? "bg-yellow-400"
                                : "bg-emerald-400"
                          }`}
                          style={{ width: `${hpPercent}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                        <span className="flex items-center gap-1 text-zinc-300">
                          <Zap className="w-3 h-3 text-sky-400" /> SKILL PT
                        </span>
                        <span className="text-sky-300 font-bold">
                          {currentSkillCost} / {maxSkillCost}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-zinc-950 border border-white/15 rounded-xs overflow-hidden">
                        <div
                          className="h-full bg-sky-400 transition-all duration-300"
                          style={{ width: `${spPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Full Details Section (ภายใต้ครึ่งวงกลม = ข้อมูลเต็ม) */}
                <div className="space-y-2.5">
                  <div className="p-2.5 bg-zinc-900/70 border border-white/10 rounded flex justify-between items-center">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />{" "}
                      Condition
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        activeChar.status_condition === "Normal" ||
                        !activeChar.status_condition
                          ? "bg-emerald-950/70 text-emerald-300 border border-emerald-800/60"
                          : "bg-amber-950 text-amber-300 border border-amber-700"
                      }`}
                    >
                      {activeChar.status_condition || "Normal"}
                    </span>
                  </div>

                  <div className="grid grid-cols-6 gap-1.5">
                    {ABILITY_SCORE_KEYS.map((key) => {
                      const raw = activeChar.stats?.[key] ?? 10;
                      const mod = abilityModifier(raw);
                      return (
                        <div
                          key={key}
                          className="bg-zinc-900/70 border border-white/10 rounded p-1.5 text-center"
                        >
                          <span className="text-[9px] text-zinc-400 block uppercase font-mono">
                            {key}
                          </span>
                          <span className="font-bold text-white text-xs font-mono block">
                            {String(raw)}
                          </span>
                          <span className="text-[9px] font-mono text-amber-400 block">
                            {formatModifier(mod)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Equipment Slots */}
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400/90 block mb-1.5">
                    Equipment Slots
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {EQUIPMENT_LABELS.map((label, idx) => {
                      const item = (activeChar.equipment ?? EMPTY_EQUIPMENT)[
                        idx
                      ];
                      return (
                        <div
                          key={label}
                          className="p-2 bg-zinc-900/70 border border-white/10 rounded text-[11px]"
                        >
                          <span className="text-[9px] text-zinc-500 uppercase font-mono block">
                            {label}
                          </span>
                          <span className="text-zinc-200 wrap-break-words">
                            {item || "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Skill Slots */}
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400/90 flex items-center gap-1 mb-1.5">
                    <Sparkles className="w-3 h-3" /> Skills (
                    {activeSkills.length})
                  </span>
                  {activeSkills.length > 0 ? (
                    <div className="space-y-1.5">
                      {activeSkills.map((skill, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-zinc-900/70 border border-white/10 rounded text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-amber-300 font-bold">
                              {skill.name || "Unnamed Skill"}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-800/70 text-[10px] font-mono text-sky-300 shrink-0">
                              Cost: {skill.cost ?? 0}
                            </span>
                          </div>
                          {skill.description && (
                            <p className="text-zinc-300 whitespace-pre-line leading-relaxed">
                              {skill.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-zinc-900/50 border border-white/10 rounded text-zinc-500 italic text-[11px]">
                      No skills registered
                    </div>
                  )}
                </div>

                {/* Inventory */}
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400/90 block mb-1.5">
                    Inventory
                  </span>
                  <div className="p-2.5 bg-zinc-900/70 border border-white/10 rounded text-zinc-200 min-h-14 whitespace-pre-line text-[11px] leading-relaxed">
                    {activeChar.inventory || "Empty"}
                  </div>
                </div>

                {/* Character Traits & Lore (Full Details when present) */}
                {(activeChar.strengths ||
                  activeChar.weaknesses ||
                  activeChar.appearance ||
                  activeChar.backstory) && (
                  <div className="space-y-2 pt-1 border-t border-white/10">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400/90 block">
                      Character Profile
                    </span>
                    {activeChar.strengths && (
                      <div className="p-2 bg-zinc-900/60 border border-white/10 rounded text-[11px]">
                        <span className="text-[9px] text-emerald-400 uppercase font-mono block">
                          Strengths
                        </span>
                        <p className="text-zinc-300 whitespace-pre-line">
                          {activeChar.strengths}
                        </p>
                      </div>
                    )}
                    {activeChar.weaknesses && (
                      <div className="p-2 bg-zinc-900/60 border border-white/10 rounded text-[11px]">
                        <span className="text-[9px] text-red-400 uppercase font-mono block">
                          Weaknesses
                        </span>
                        <p className="text-zinc-300 whitespace-pre-line">
                          {activeChar.weaknesses}
                        </p>
                      </div>
                    )}
                    {activeChar.appearance && (
                      <div className="p-2 bg-zinc-900/60 border border-white/10 rounded text-[11px]">
                        <span className="text-[9px] text-zinc-400 uppercase font-mono block">
                          Appearance
                        </span>
                        <p className="text-zinc-300 whitespace-pre-line">
                          {activeChar.appearance}
                        </p>
                      </div>
                    )}
                    {activeChar.backstory && (
                      <div className="p-2 bg-zinc-900/60 border border-white/10 rounded text-[11px]">
                        <span className="text-[9px] text-zinc-400 uppercase font-mono block">
                          Backstory
                        </span>
                        <p className="text-zinc-300 whitespace-pre-line">
                          {activeChar.backstory}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SAO Window Footer */}
          {isEditingChar && (
            <div className="border-t border-white/15 bg-zinc-900/90 px-4 py-2.5">
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onSaveCharEdits}
                  disabled={isSavingChar}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 rounded text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />{" "}
                  {isSavingChar ? "Saving..." : "Save Sheet"}
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
