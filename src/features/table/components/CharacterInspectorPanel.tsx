"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Edit3,
  Heart,
  Link2,
  Package,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import { useAlert } from "@/components/ui/AlertModal";
import {
  EMPTY_EQUIPMENT,
  extractCharacterSkillCost,
  extractCharacterSkills,
  extractCharacterInventory,
  getHpTailwindClass,
  type CharacterInventoryItem,
} from "@/features/character/domain";
import {
  CLASSIC_TEMPLATE,
  COLUMN_EQUIPMENT_SLOT_INDEX,
  COLUMN_RESOURCE_IDS,
  clampStatValue,
  isColumnStatId,
  isColumnTextFieldId,
  readCharacterTemplate,
  readCustomValues,
  type CharacterTemplate,
  type ResourceColor,
} from "@/features/character/template";
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

const CUSTOM_RESOURCE_BAR_COLOR: Record<
  ResourceColor,
  { text: string; bg: string }
> = {
  red: { text: "text-red-400", bg: "bg-red-500" },
  amber: { text: "text-amber-400", bg: "bg-amber-400" },
  cyan: { text: "text-cyan-400", bg: "bg-cyan-400" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-400" },
  violet: { text: "text-violet-400", bg: "bg-violet-500" },
  rose: { text: "text-rose-400", bg: "bg-rose-500" },
  sky: { text: "text-sky-400", bg: "bg-sky-400" },
  zinc: { text: "text-zinc-400", bg: "bg-zinc-400" },
};

type CharacterInspectorPanelProps = {
  activeChar: Character | null | undefined;
  userCharacters: Character[];
  campaignTemplate?: CharacterTemplate;
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
  campaignTemplate = CLASSIC_TEMPLATE,
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
  const { showAlert } = useAlert();
  const router = useRouter();
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

  const activeTemplate = readCharacterTemplate(activeChar);
  const activeCustom = readCustomValues(activeChar);
  const formCustom = charForm.sheet_custom ?? activeCustom;

  const hpResourceDef = activeTemplate.resources.find((r) => r.id === "hp");
  const spResourceDef = activeTemplate.resources.find(
    (r) => r.id === "skill_cost",
  );
  const customResourceDefs = activeTemplate.resources.filter(
    (r) => !(COLUMN_RESOURCE_IDS as readonly string[]).includes(r.id),
  );
  const hpLabel = hpResourceDef?.label || "HP";
  const spLabel =
    spResourceDef?.id === "skill_cost" && spResourceDef.label === "Skill Cost"
      ? "SKILL PT"
      : spResourceDef?.label || "SKILL PT";

  const activeSkills = extractCharacterSkills(activeChar);
  const activeInventory = extractCharacterInventory(activeChar);
  const formInventoryItems: CharacterInventoryItem[] = Array.isArray(
    charForm.inventory,
  )
    ? charForm.inventory
    : extractCharacterInventory({ inventory: charForm.inventory });
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
  const hpColors = getHpTailwindClass(curHp, maxHp);
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

  // Helper to read text fields (both column fields and custom fields) on activeChar
  const populatedTextFields = activeChar
    ? activeTemplate.textFields
        .map((field) => {
          const charMap = activeChar as unknown as Record<string, unknown>;
          const value = isColumnTextFieldId(field.id)
            ? String(charMap[field.id] || "").trim()
            : String(activeCustom.fields[field.id] || "").trim();
          return { field, value };
        })
        .filter((entry) => entry.value.length > 0)
    : [];

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
                  {activeChar
                    ? `${activeChar.class_archetype || 'Adventurer'} • ${activeTemplate.name} (ผู้สร้างชีท: ${activeTemplate.author || 'D&D Playground'})`
                    : "Select a character sheet below"}
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
                    <span>Select character for this session:</span>
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

                {/* Campaign Requirement Banner */}
                <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      Required: {campaignTemplate.name} (ผู้สร้างชีท: {campaignTemplate.author || 'Campaign Creator'})
                    </span>
                    <span className="text-[10px] font-medium bg-amber-900/70 text-amber-200 px-2 py-0.5 rounded border border-amber-700/60">
                      Enforced
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    {campaignTemplate.description}
                  </p>
                  <div className="flex flex-wrap gap-1 text-[10px] pt-0.5">
                    {campaignTemplate.resources.length > 0 ? (
                      campaignTemplate.resources.map((r) => (
                        <span key={r.id} className="bg-zinc-900/90 border border-zinc-700/60 text-zinc-300 px-1.5 py-0.5 rounded">
                          {r.label}
                        </span>
                      ))
                    ) : (
                      <span className="bg-amber-950/80 border border-amber-800 text-amber-300 px-1.5 py-0.5 rounded font-medium">
                        0 Resource Bars (Item & Clues Only)
                      </span>
                    )}
                    <span className="bg-zinc-900/90 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                      {campaignTemplate.stats.length} Stats
                    </span>
                    <span className="bg-zinc-900/90 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                      {campaignTemplate.equipmentSlots.length} Gear Slots
                    </span>
                  </div>
                </div>

                {/* 1-Click Create Character for Campaign */}
                <Link
                  href={`/characters?tableCode=${encodeURIComponent(tableCode)}&templateId=${encodeURIComponent(campaignTemplate.id)}&returnTo=${encodeURIComponent(`/table/${tableCode}`)}`}
                  className="w-full py-2.5 px-3 bg-linear-to-r from-amber-600/90 to-amber-500/90 hover:from-amber-600 hover:to-amber-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> สร้างตัวละครจากเทมเพลตที่แคมเปญกำหนด
                </Link>

                {/* Character List with Compatibility Checking */}
                <div className="space-y-2 pt-1">
                  {userCharacters.map((char) => {
                    const charTemplate = readCharacterTemplate(char);
                    const isCompatible = charTemplate.id === campaignTemplate.id;
                    const cost = extractCharacterSkillCost(char);

                    const handleMismatchedCharClick = () => {
                      showAlert({
                        title: "รูปแบบชีทไม่ตรงกับข้อกำหนดของแคมเปญ",
                        status: "warning",
                        badge: "Sheet Mismatch",
                        maxWidth: "md",
                        buttonText: "เลือกตัวละครอื่น",
                        action: {
                          label: "สร้างตัวละครใหม่สำหรับแคมเปญนี้",
                          variant: "accent",
                          onClick: () => {
                            router.push(
                              `/characters?tableCode=${encodeURIComponent(tableCode)}&templateId=${encodeURIComponent(campaignTemplate.id)}&returnTo=${encodeURIComponent(`/table/${tableCode}`)}`
                            );
                          },
                        },
                        message: (
                          <div className="space-y-3 text-xs">
                            <p className="text-zinc-300 leading-relaxed">
                              ไม่สามารถนำตัวละคร <strong className="text-white font-semibold">&ldquo;{char.name}&rdquo;</strong> เข้าร่วมเล่นได้ เนื่องจากแคมเปญนี้กำหนดโครงสร้างแผ่นตัวละครเฉพาะ
                            </p>

                            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 space-y-3 text-left">
                              {/* Character's Template */}
                              <div className="border-b border-zinc-800/80 pb-2.5">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">
                                  รูปแบบของตัวละครนี้ ({char.name})
                                </span>
                                <span className="text-amber-400 font-bold text-sm block mt-0.5">
                                  {charTemplate.name} <span className="text-xs text-zinc-400 font-normal">(ผู้สร้าง: {charTemplate.author || 'D&D Playground'})</span>
                                </span>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                    {charTemplate.resources.length > 0
                                      ? `${charTemplate.resources.length} หลอดพลัง (${charTemplate.resources.map((r) => r.label).join(', ')})`
                                      : '0 หลอดพลัง (เน้นไอเทม & เบาะแส)'}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                    {charTemplate.stats.length} สเตตัส
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                    {charTemplate.equipmentSlots.length} ช่องอุปกรณ์
                                  </span>
                                </div>
                              </div>

                              {/* Campaign's Required Template */}
                              <div className="pt-0.5">
                                <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                                  <Check className="w-3 h-3" /> แคมเปญนี้กำหนดให้ใช้ (Required Format)
                                </span>
                                <span className="text-emerald-300 font-bold text-sm block mt-0.5">
                                  {campaignTemplate.name} <span className="text-xs text-emerald-400/80 font-normal">(ผู้สร้าง: {campaignTemplate.author || 'Campaign Creator'})</span>
                                </span>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                                    {campaignTemplate.resources.length > 0
                                      ? `${campaignTemplate.resources.length} หลอดพลัง (${campaignTemplate.resources.map((r) => r.label).join(', ')})`
                                      : '0 หลอดพลัง (เน้นไอเทม & เบาะแส)'}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                                    {campaignTemplate.stats.length} สเตตัส
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                                    {campaignTemplate.equipmentSlots.length} ช่องอุปกรณ์
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="p-2.5 bg-amber-950/30 border border-amber-800/50 rounded-lg text-amber-200/90 text-[11px] leading-relaxed flex items-start gap-2">
                              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <span>
                                <strong>คำแนะนำ:</strong> คุณสามารถกดปุ่ม <span className="text-amber-300 underline font-semibold">&ldquo;สร้างตัวละครใหม่สำหรับแคมเปญนี้&rdquo;</span> ด้านล่าง เพื่อเข้าสู่หน้าสร้างตัวละครด้วยเทมเพลตที่ตรงกับแคมเปญได้ทันที
                              </span>
                            </div>
                          </div>
                        ),
                      });
                    };

                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => {
                          if (!isCompatible) {
                            handleMismatchedCharClick();
                            return;
                          }
                          onSelectCharacter(char.id);
                        }}
                        className={`w-full text-left p-3 rounded-lg border text-xs transition cursor-pointer ${
                          isCompatible
                            ? 'bg-zinc-900/80 border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-950/20 ring-1 ring-emerald-500/20'
                            : 'bg-zinc-950/60 border-zinc-800/80 opacity-60 hover:opacity-90 hover:border-red-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-white flex items-center gap-1.5">
                            {char.name}
                            {isCompatible ? (
                              <span className="text-[10px] font-normal bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Check className="w-3 h-3" /> Compatible
                              </span>
                            ) : (
                              <span className="text-[10px] font-normal bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.5 rounded">
                                {charTemplate.name} ({charTemplate.author || 'D&D Playground'})
                              </span>
                            )}
                          </p>
                          {!isCompatible && (
                            <span className="text-[10px] text-red-400 flex items-center gap-1 font-mono">
                              <AlertCircle className="w-3 h-3" /> Mismatched
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-400 font-mono text-[11px] mt-1">
                          {char.class_archetype || 'Adventurer'}
                          {charTemplate.resources.length > 0
                            ? ` · HP ${char.current_hp ?? 0}/${char.max_hp ?? 0} · SP ${cost.currentSkillCost}/${cost.maxSkillCost}`
                            : ' · 0 Resources (Item/Clue only)'}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {userCharacters.length > 0 && !userCharacters.some((c) => readCharacterTemplate(c).id === campaignTemplate.id) && (
                  <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs space-y-2 text-amber-200">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>ยังไม่มีตัวละครที่ตรงตามเงื่อนไขของแคมเปญนี้</span>
                    </div>
                    <p className="text-[11px] text-amber-200/80 leading-relaxed">
                      แคมเปญนี้กำหนดให้ใช้รูปแบบชีท <strong className="text-white font-medium">&ldquo;{campaignTemplate.name}&rdquo;</strong> คุณสามารถกดปุ่มด้านล่างเพื่อสร้างตัวละครที่ตรงตามเงื่อนไขได้ทันที
                    </p>
                    <Link
                      href={`/characters?tableCode=${encodeURIComponent(tableCode)}&templateId=${encodeURIComponent(campaignTemplate.id)}&returnTo=${encodeURIComponent(`/table/${tableCode}`)}`}
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-linear-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> สร้างตัวละครจากเทมเพลตของแคมเปญนี้
                    </Link>
                  </div>
                )}

                {userCharacters.length === 0 && (
                  <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl text-center space-y-2.5">
                    <p className="text-xs text-zinc-400">
                      ยังไม่พบแผ่นตัวละครในคลังของคุณ
                    </p>
                    <Link
                      href={`/characters?tableCode=${encodeURIComponent(tableCode)}&templateId=${encodeURIComponent(campaignTemplate.id)}&returnTo=${encodeURIComponent(`/table/${tableCode}`)}`}
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-linear-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> สร้างตัวละครสำหรับแคมเปญนี้ทันที
                    </Link>
                  </div>
                )}
              </div>
            ) : isEditingChar ? (
              /* Inline Character Combat Editor */
              <div className="space-y-4 text-xs">
                {(hpResourceDef || activeTemplate.resources.length === 0) && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-mono">
                        Current {hpLabel}
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
                        Max {hpLabel}
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
                )}

                {spResourceDef && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-mono">
                        Current {spResourceDef.label || "Skill Cost"}
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
                        Max {spResourceDef.label || "Skill Cost"}
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
                )}

                {/* Custom Template Resource Bars Editor (Stress, Luck, etc.) */}
                {customResourceDefs.map((res) => {
                  const existing = formCustom.resources[res.id] || {
                    current: res.defaultMax,
                    max: res.defaultMax,
                  };
                  return (
                    <div key={res.id} className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-zinc-400 uppercase font-mono">
                          Current {res.label}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={existing.max}
                          value={existing.current}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const nextCurrent = Number.isNaN(val)
                              ? 0
                              : Math.max(0, Math.min(existing.max, val));
                            onChangeCharForm({
                              ...charForm,
                              sheet_custom: {
                                ...formCustom,
                                resources: {
                                  ...formCustom.resources,
                                  [res.id]: {
                                    current: nextCurrent,
                                    max: existing.max,
                                  },
                                },
                              },
                            });
                          }}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white focus:border-amber-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 uppercase font-mono">
                          Max {res.label}
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={existing.max}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const nextMax = Number.isNaN(val)
                              ? 0
                              : Math.max(0, val);
                            const nextCurrent = Math.min(
                              nextMax,
                              existing.current,
                            );
                            onChangeCharForm({
                              ...charForm,
                              sheet_custom: {
                                ...formCustom,
                                resources: {
                                  ...formCustom.resources,
                                  [res.id]: {
                                    current: nextCurrent,
                                    max: nextMax,
                                  },
                                },
                              },
                            });
                          }}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white focus:border-amber-400 outline-none"
                        />
                      </div>
                    </div>
                  );
                })}

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
                    {activeTemplate.conditions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    {charForm.status_condition &&
                      !activeTemplate.conditions.includes(
                        charForm.status_condition,
                      ) && (
                        <option value={charForm.status_condition}>
                          {charForm.status_condition}
                        </option>
                      )}
                  </select>
                </div>

                {/* Stats Editor (Dynamic Template Stats) */}
                {activeTemplate.stats.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-zinc-400 uppercase font-mono block">
                        Attributes & Stats
                      </label>
                      <span className="text-[9px] text-zinc-500 font-mono">
                        Allows negative
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {activeTemplate.stats.map((stat) => {
                        const isCol = isColumnStatId(stat.id);
                        const currentVal = isCol
                          ? (charForm.stats[stat.id] ?? stat.default)
                          : (formCustom.stats[stat.id] ??
                            charForm.stats[stat.id] ??
                            stat.default);
                        return (
                          <div
                            key={stat.id}
                            className="bg-zinc-900 border border-zinc-800 rounded p-1 text-center"
                          >
                            <span
                              className="text-[9px] text-zinc-500 uppercase block truncate"
                              title={stat.label}
                            >
                              {stat.label}
                            </span>
                            <input
                              type="number"
                              min={stat.min ?? undefined}
                              max={stat.max ?? undefined}
                              value={currentVal}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === "" || raw === "-") {
                                  onChangeCharForm({
                                    ...charForm,
                                    stats: {
                                      ...charForm.stats,
                                      [stat.id]: raw,
                                    },
                                  });
                                  return;
                                }
                                const val = Number(raw);
                                if (!Number.isNaN(val)) {
                                  const clamped = clampStatValue(stat, val);
                                  onChangeCharForm({
                                    ...charForm,
                                    stats: {
                                      ...charForm.stats,
                                      [stat.id]: clamped,
                                    },
                                    sheet_custom: isCol
                                      ? formCustom
                                      : {
                                          ...formCustom,
                                          stats: {
                                            ...formCustom.stats,
                                            [stat.id]: clamped,
                                          },
                                        },
                                  });
                                }
                              }}
                              className="w-full bg-transparent text-center font-bold text-xs text-white outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Inventory Editor */}
                {activeTemplate.sections.inventory && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-zinc-400 uppercase font-mono block">
                        Inventory
                      </label>
                      <span className="text-[9px] text-zinc-500 font-mono">
                        {formInventoryItems.length} item(s)
                      </span>
                    </div>
                    <div className="space-y-2">
                      {formInventoryItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-zinc-900 border border-zinc-800 rounded space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-amber-500 font-mono uppercase">
                              Item #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextItems = formInventoryItems.filter(
                                  (_, i) => i !== idx,
                                );
                                onChangeCharForm({
                                  ...charForm,
                                  inventory: nextItems,
                                });
                              }}
                              title="Remove item"
                              className="text-zinc-500 hover:text-red-400 p-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="col-span-2">
                              <span className="text-[9px] text-zinc-400 uppercase font-mono block">
                                Item Name :
                              </span>
                              <input
                                type="text"
                                placeholder="Item name..."
                                value={item.name}
                                onChange={(e) => {
                                  const nextItems = [...formInventoryItems];
                                  nextItems[idx] = {
                                    ...nextItems[idx],
                                    name: e.target.value,
                                  };
                                  onChangeCharForm({
                                    ...charForm,
                                    inventory: nextItems,
                                  });
                                }}
                                className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded p-1 text-[11px] text-white"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-400 uppercase font-mono block">
                                Qty :
                              </span>
                              <input
                                type="number"
                                min={1}
                                placeholder="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  const nextItems = [...formInventoryItems];
                                  nextItems[idx] = {
                                    ...nextItems[idx],
                                    quantity: Number.isNaN(val)
                                      ? 1
                                      : Math.max(1, val),
                                  };
                                  onChangeCharForm({
                                    ...charForm,
                                    inventory: nextItems,
                                  });
                                }}
                                className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded p-1 text-[11px] text-white text-center"
                              />
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] text-zinc-400 uppercase font-mono block">
                              Description :
                            </span>
                            <input
                              type="text"
                              placeholder="Effect / description (optional)..."
                              value={item.description || ""}
                              onChange={(e) => {
                                const nextItems = [...formInventoryItems];
                                nextItems[idx] = {
                                  ...nextItems[idx],
                                  description: e.target.value,
                                };
                                onChangeCharForm({
                                  ...charForm,
                                  inventory: nextItems,
                                });
                              }}
                              className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded p-1 text-[11px] text-white"
                            />
                          </div>
                        </div>
                      ))}
                      {formInventoryItems.length === 0 && (
                        <div className="p-3 bg-zinc-900/50 border border-dashed border-zinc-800 rounded text-center text-zinc-500 text-[11px]">
                          No items in inventory
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeCharForm({
                          ...charForm,
                          inventory: [
                            ...formInventoryItems,
                            { name: "", quantity: 1, description: "" },
                          ],
                        })
                      }
                      className="w-full py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700 hover:border-amber-500/60 text-amber-400 rounded text-[11px] font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  </div>
                )}

                {/* Equipment Slots Editor */}
                {activeTemplate.equipmentSlots.length > 0 && (
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">
                      Equipment Slots
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {activeTemplate.equipmentSlots.map((slot) => {
                        const colIdx = COLUMN_EQUIPMENT_SLOT_INDEX[slot.id];
                        const val =
                          colIdx !== undefined
                            ? (charForm.equipment ?? EMPTY_EQUIPMENT)[colIdx] ||
                              ""
                            : formCustom.equipment[slot.id] || "";
                        return (
                          <div key={slot.id}>
                            <span className="text-[9px] text-zinc-500 uppercase block truncate">
                              {slot.label}
                            </span>
                            <input
                              type="text"
                              placeholder={`${slot.label}...`}
                              value={val}
                              onChange={(e) => {
                                if (colIdx !== undefined) {
                                  const next = [
                                    ...(charForm.equipment ?? EMPTY_EQUIPMENT),
                                  ];
                                  next[colIdx] = e.target.value;
                                  onChangeCharForm({
                                    ...charForm,
                                    equipment: next,
                                  });
                                } else {
                                  onChangeCharForm({
                                    ...charForm,
                                    sheet_custom: {
                                      ...formCustom,
                                      equipment: {
                                        ...formCustom.equipment,
                                        [slot.id]: e.target.value,
                                      },
                                    },
                                  });
                                }
                              }}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-[11px] text-white focus:border-amber-400 outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Skill Editor */}
                {activeTemplate.sections.skills && (
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
                                const nextSkills = (
                                  charForm.skills || []
                                ).filter((_, i) => i !== idx);
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
                                  cost: Number.isNaN(val)
                                    ? 0
                                    : Math.max(0, val),
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
                )}
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

                  {/* SAO Linear Resource Gauge Bars right beneath the dial (ordered by template.resources) */}
                  {activeTemplate.resources.length > 0 && (
                    <div
                      className={`w-full grid ${
                        activeTemplate.resources.length === 1
                          ? "grid-cols-1"
                          : "grid-cols-2"
                      } gap-3 mt-2 pt-2.5 border-t border-white/10`}
                    >
                      {activeTemplate.resources.map((res) => {
                        if (res.id === "hp") {
                          return (
                            <div key={res.id}>
                              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                <span className="flex items-center gap-1 text-zinc-300 truncate">
                                  <Heart
                                    className={`w-3 h-3 shrink-0 ${hpColors.text}`}
                                  />{" "}
                                  {hpLabel}
                                </span>
                                <span className="text-white font-bold shrink-0">
                                  {activeChar.current_hp} / {activeChar.max_hp}
                                </span>
                              </div>
                              <div className="h-2 w-full bg-zinc-950 border border-white/15 rounded-xs overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${hpColors.bg}`}
                                  style={{ width: `${hpPercent}%` }}
                                />
                              </div>
                            </div>
                          );
                        }

                        if (res.id === "skill_cost") {
                          return (
                            <div key={res.id}>
                              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                <span className="flex items-center gap-1 text-zinc-300 truncate">
                                  <Zap className="w-3 h-3 text-sky-400 shrink-0" />{" "}
                                  {spLabel}
                                </span>
                                <span className="text-sky-300 font-bold shrink-0">
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
                          );
                        }

                        const val = activeCustom.resources[res.id] || {
                          current: res.defaultMax,
                          max: res.defaultMax,
                        };
                        const pct =
                          val.max > 0
                            ? Math.max(
                                0,
                                Math.min(
                                  100,
                                  Math.round((val.current / val.max) * 100),
                                ),
                              )
                            : 0;
                        const colorTheme =
                          CUSTOM_RESOURCE_BAR_COLOR[res.color] ||
                          CUSTOM_RESOURCE_BAR_COLOR.zinc;
                        return (
                          <div key={res.id}>
                            <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                              <span
                                className={`truncate font-semibold ${colorTheme.text}`}
                              >
                                {res.label}
                              </span>
                              <span className="text-white font-bold shrink-0">
                                {val.current} / {val.max}
                              </span>
                            </div>
                            <div className="h-2 w-full bg-zinc-950 border border-white/15 rounded-xs overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${colorTheme.bg}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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

                  {activeTemplate.stats.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {activeTemplate.stats.map((stat) => {
                        const isCol = isColumnStatId(stat.id);
                        const raw = isCol
                          ? (activeChar.stats?.[stat.id] ?? stat.default)
                          : (activeCustom.stats[stat.id] ??
                            activeChar.stats?.[stat.id] ??
                            stat.default);
                        const numericRaw =
                          typeof raw === "number" || typeof raw === "string"
                            ? raw
                            : stat.default;
                        const mod = abilityModifier(numericRaw, activeTemplate.mechanics.statModifier);
                        return (
                          <div
                            key={stat.id}
                            className="bg-zinc-900/70 border border-white/10 rounded p-1.5 text-center"
                          >
                            <span
                              className="text-[9px] text-zinc-400 block uppercase font-mono truncate"
                              title={stat.label}
                            >
                              {stat.label}
                            </span>
                            <span className="font-bold text-white text-xs font-mono block">
                              {String(raw)}
                            </span>
                            <span className="text-[9px] font-mono text-amber-400 block">
                              {activeTemplate.mechanics.statModifier === 'none' ? '—' : formatModifier(mod)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Equipment Slots */}
                {activeTemplate.equipmentSlots.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400/90 block mb-1.5">
                      Equipment Slots
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {activeTemplate.equipmentSlots.map((slot) => {
                        const colIdx = COLUMN_EQUIPMENT_SLOT_INDEX[slot.id];
                        const item =
                          colIdx !== undefined
                            ? (activeChar.equipment ?? EMPTY_EQUIPMENT)[colIdx]
                            : activeCustom.equipment[slot.id];
                        return (
                          <div
                            key={slot.id}
                            className="p-2 bg-zinc-900/70 border border-white/10 rounded text-[11px]"
                          >
                            <span className="text-[9px] text-zinc-500 uppercase font-mono block">
                              {slot.label}
                            </span>
                            <span className="text-zinc-200 wrap-break-words">
                              {item || "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Skill Slots */}
                {activeTemplate.sections.skills && (
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
                )}

                {/* Inventory */}
                {activeTemplate.sections.inventory && (
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400/90 flex items-center gap-1.5 mb-1.5">
                      <Package className="w-3 h-3" /> Inventory (
                      {activeInventory.length})
                    </span>
                    {activeInventory.length > 0 ? (
                      <div className="space-y-1.5">
                        {activeInventory.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-zinc-900/70 border border-white/10 rounded text-[11px] space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-amber-300 font-bold">
                                {item.name || "Unnamed Item"}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800/70 text-[10px] font-mono text-amber-300 shrink-0">
                                x{item.quantity}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-zinc-300 whitespace-pre-line leading-relaxed">
                                {item.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2.5 bg-zinc-900/50 border border-white/10 rounded text-zinc-500 italic text-[11px]">
                        Inventory is empty
                      </div>
                    )}
                  </div>
                )}

                {/* Character Traits & Lore (Dynamic Template Text Fields) */}
                {populatedTextFields.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-white/10">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400/90 block">
                      Character Profile
                    </span>
                    {populatedTextFields.map(({ field, value }) => {
                      const labelColor =
                        field.id === "strengths"
                          ? "text-emerald-400"
                          : field.id === "weaknesses"
                            ? "text-red-400"
                            : "text-zinc-400";
                      return (
                        <div
                          key={field.id}
                          className="p-2 bg-zinc-900/60 border border-white/10 rounded text-[11px]"
                        >
                          <span
                            className={`text-[9px] uppercase font-mono block ${labelColor}`}
                          >
                            {field.label}
                          </span>
                          <p className="text-zinc-300 whitespace-pre-line">
                            {value}
                          </p>
                        </div>
                      );
                    })}
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
