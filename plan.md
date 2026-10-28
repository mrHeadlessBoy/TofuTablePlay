# Implementation Plan: Full-Stack Bilingual Localization (EN & TH) for UI & AI DM Engine

> **Objective:** Implement a comprehensive bilingual system (English & Thai) across the entire application, spanning all user interface elements (buttons, forms, modals, codex, table controls, HUD) and the AI Dungeon Master narration engine, allowing players and table hosts to seamlessly switch between English and Thai.
>
> **Status:** 
> - **Preceding Feature (Template Enforcements & 0-Resource Play):** Phases 1, 2, 3, A, and B are **100% Completed & Verified**.
> - **Current Target (Full-Stack EN & TH Localization & Bilingual AI DM Engine):** **100% Completed & Verified**. Zero TypeScript errors, zero ESLint errors/warnings.

---

## 1. Architecture & Design

```mermaid
flowchart TD
    subgraph I18nCore["Core Localization Layer (src/lib/i18n/)"]
        DictTH["th.ts (Thai Dictionary)"]
        DictEN["en.ts (English Dictionary)"]
        Types["types.ts (Typed Keys & Translation Schema)"]
        Provider["LanguageProvider & useLanguage() Hook<br/>(Reactive Context + localStorage + Cookie Sync)"]
        Toggle["LanguageToggle Component (🇹🇭 TH / 🇺🇸 EN)"]
        DictTH --> Provider
        DictEN --> Provider
        Types --> Provider
        Provider --> Toggle
    end

    subgraph ClientUI["Frontend Pages & Components"]
        Hub["Hub & Active Tables (/hub)"]
        Campaign["Campaign Studio (/campaigns)"]
        CharCodex["Character Codex & Editor (/characters)"]
        TableUI["Multiplayer Table & SAO HUD (/table/[id])"]
        Modals["Modals (AlertModal, TemplateModal)"]
        Toggle --> Hub
        Toggle --> Campaign
        Toggle --> CharCodex
        Toggle --> TableUI
        Provider --> Modals
    end

    subgraph AIDMEngine["AI Dungeon Master Engine (src/lib/ai/dm.ts)"]
        TableSettings["Table / Host Language Preference ('th' | 'en')"]
        PromptBuilder["Prompt Builder (formatPartyMember, Rules, Overviews)"]
        Gemini["Google Gemini AI DM"]
        TableSettings --> PromptBuilder
        PromptBuilder -->|Directs output language: English or Thai| Gemini
        Gemini -->|Narration, [Overview], [Decision]| TableUI
    end
```

---

## 2. Component & Implementation Breakdown

### Phase 1: I18n Core Infrastructure & Dictionaries
**Files:**
- `src/lib/i18n/types.ts`
- `src/lib/i18n/locales/th.ts`
- `src/lib/i18n/locales/en.ts`
- `src/lib/i18n/LanguageContext.tsx`
- `src/components/ui/LanguageToggle.tsx`

1. **Translation Types & Structure (`src/lib/i18n/types.ts`)**:
   - Strict TypeScript dictionary interface covering namespaces:
     - `common` (Actions, confirmations, loading, cancel, save, delete, back, copy, error, success)
     - `nav` (Hub, Character Sheets, New Campaign, Sign Out, Table, Back to Hub)
     - `hub` (Active tables, campaign list, table code input, join button, invite links, re-enter)
     - `campaign` (Studio title, category, world setting, lorebook, rule mechanics builder, template requirements, creators)
     - `character` (Roster, identity, archetype, vitality resources, attributes/stats, equipment slots, skills, inventory, conditions)
     - `table` (Turn phase, countdown timer, player actions, ready button, host narrative edit, kick, leave, log)
     - `sao` (Player status, crest gauges, stats dial, inline editor, sheet compatibility warnings, template author)
     - `aiDm` (Language directive, overview titles, decisions, status descriptions)
2. **Dictionary Files (`th.ts` & `en.ts`)**:
   - Accurate, native Thai and English translations with consistent tabletop roleplaying terminology.
   - Dynamic parameter substitution helper: `t(key, { name: 'Player' })`.
3. **Reactive Provider (`LanguageContext.tsx`)**:
   - Context providing:
     - `language: 'th' | 'en'`
     - `setLanguage: (lang: 'th' | 'en') => void`
     - `t: (key: string, params?: Record<string, string | number>) => string`
   - Initial state auto-detected from `localStorage` or browser language with fallback to `'th'`.
   - Sets document cookie `app_locale` to ensure SSR hydration consistency.
4. **Header Toggle Component (`LanguageToggle.tsx`)**:
   - Elegant, compact switcher with flags and text: `🇹🇭 TH | 🇺🇸 EN` with keyboard and touch support.

---

### Phase 2: Global Layout & Navigation Integration
**Files:**
- `src/app/layout.tsx`
- `src/components/ui/AlertModal.tsx`
- Global headers across routes

1. Wrap root layout with `<LanguageProvider>`.
2. Place `<LanguageToggle />` in:
   - Hub Header (`src/app/hub/page.tsx`)
   - Campaign Form & Details Header (`src/app/campaigns/...`)
   - Character Codex Header (`src/app/characters/page.tsx`)
   - Table Topbar (`src/features/table/components/TablePlayground.tsx`)
3. Update `AlertModal.tsx` to utilize translation keys for default buttons (`Confirm`, `Cancel`, `OK`, `Delete`).

---

### Phase 3: Campaign Hub & Campaign Studio Localization
**Files:**
- `src/features/hub/components/HubClient.tsx`
- `src/app/hub/page.tsx`
- `src/app/campaigns/[id]/page.tsx`
- `src/features/campaign/components/CampaignForm.tsx`

1. **Campaign Hub**:
   - Localize Quick Join section, 6-character code input, Invite Link badges, Turn/Phase labels, Re-enter, Leave Table, and Delete Table buttons.
   - Localize Public Campaign cards (`สร้างโดย: ...`, `รูปแบบชีท: ...`, `Launch as Head Table`, `Details`, `Edit`, `Delete`).
2. **Campaign Studio & Details (`CampaignForm.tsx` & `[id]/page.tsx`)**:
   - Localize all form labels, placeholders, genre selector options, and validation alerts.
   - Localize Structured Rule Mechanics Builder (`Rule Title`, `Category`, `Description`, `+ Add Rule`, `Remove`).
   - Localize Required Sheet Template cards, Built-in presets (`Classic`, `Drama`, `Romance`, `Horror`), and Custom Template Creator buttons.
   - Localize Campaign Details view and Lorebook view (`Activation Mode`, `Trigger Keys`, `Secret/DM-Only`).

---

### Phase 4: Character Codex & Sheet Editor Localization
**Files:**
- `src/features/character/components/CharacterEditor.tsx`
- `src/features/character/components/TemplateModal.tsx`

1. **Character Codex (`CharacterEditor.tsx`)**:
   - Localize Character Roster sidebar (`+ Create New Character`, template badges, delete confirmation).
   - Localize Sheet Editor header, template selector dropdown, and `Customize Template` button.
   - Localize Core Identity fields (`Name`, `Archetype`, `Appearance`, `Backstory`, `Strengths`, `Weaknesses`).
   - Localize Dynamic Attributes, Vitality / Resource bars, Equipment Slots, Skills Section, and Inventory Section.
   - Localize Campaign Template requirement alerts (`กำลังสร้างตัวละครสำหรับแคมเปญนี้...` / `Creating character for this campaign...`).
2. **Template Builder Modal (`TemplateModal.tsx`)**:
   - Localize tabs: `Basic Info`, `Resources`, `Stats`, `Equipment Slots`, `Conditions`, `Rules & Mechanics`, `Share Key & JSON`.
   - Localize all helper descriptions, presets, and export/import controls.

---

### Phase 5: Multiplayer Tabletop & SAO Inspector Localization
**Files:**
- `src/features/table/components/TablePlayground.tsx`
- `src/features/table/components/CharacterInspectorPanel.tsx`
- `src/features/table/components/SaoCharacterOrb.tsx`
- `src/features/table/components/PartyRosterSidebar.tsx`
- `src/features/table/components/LorebookSidebar.tsx`
- `src/features/dice/DiceRoller.tsx`

1. **Multiplayer Tabletop Controls**:
   - Localize Turn Phase badges (`Waiting for actions`, `Resolving turn with AI DM`, `Turn complete`).
   - Localize countdown timer, action text area, ready toggle (`Ready Up` / `Cancel Ready`), action character limit notice.
   - Localize Host tools: Narrative Override editor, kick member, advance turn, leave table.
2. **SAO Floating Dial & Character Inspector**:
   - Localize `PLAYER STATUS`, `HOST`, `PARTY`, `No Character Bound`, `Edit`, `Switch`, and inline combat editor.
   - Localize Character Switcher & Compatibility Warning Modal (Template comparison, `Compatible`, `Mismatched`, 1-click create button).
   - Localize 3D Polyhedral Dice Roller labels (`Advantage`, `Disadvantage`, `Modifier`, `Target DC`, `Roll Dice`).
3. **Party & Lorebook Sidebars**:
   - Localize party roster cards, resource gauges, active conditions, and lore entries.

---

### Phase 6: AI Dungeon Master Multilingual Engine
**Files:**
- `src/lib/ai/dm.ts`
- `src/features/table/actions.ts`

1. **Table Language Setting**:
   - Add language parameter (`language: 'th' | 'en'`) to `generateDmNarrative` and `generateOpeningNarrative`.
   - Derive the language from either:
     - Table record / Host selection in table settings.
     - Fallback to caller's language preference.
2. **System Prompt Directives**:
   - **When `language === 'en'`**:
     - System prompt instructs:
       ```text
       [ LANGUAGE DIRECTIVE ]
       - Narrate the story, events, NPC dialogues, descriptions, and outcomes entirely in fluent, atmospheric English.
       - Use evocative fantasy/genre roleplay prose.
       - Format the [ Overview ] section in English:
         [ Overview ]
         Location & Atmosphere: ...
         Active Situation & Danger: ...
         Party Status: [Character Name]: [Status condition / Resource state]
         Enemy Status: [Enemy Name] (HP: X%)
       - Format [ Decision ] choices in English with appropriate DC and skill checks.
       ```
   - **When `language === 'th'`**:
     - System prompt instructs narrative in Thai (maintaining the existing polished Thai RPG prose guidelines).
3. **Party Update & Overview Compatibility**:
   - Ensure `extractPartyStateUpdates` parses both English and Thai status/item formats seamlessly.

---

## 3. Implementation Steps Order

| Step | Phase | Task Description | Target Files |
| :---: | :---: | :--- | :--- |
| **1** | 1 | Create i18n core infrastructure: types, Thai dictionary (`th.ts`), English dictionary (`en.ts`), `LanguageContext`, and `<LanguageToggle />` | `src/lib/i18n/*`, `src/components/ui/LanguageToggle.tsx` |
| **2** | 2 | Wrap application with `<LanguageProvider>` in root layout and localize `AlertModal` & navigation headers | `src/app/layout.tsx`, `AlertModal.tsx` |
| **3** | 3 | Localize Campaign Hub and Public Campaign cards | `src/app/hub/page.tsx`, `HubClient.tsx` |
| **4** | 3 | Localize Campaign Studio, Custom Rules builder, and Campaign Details view | `CampaignForm.tsx`, `campaigns/[id]/page.tsx` |
| **5** | 4 | Localize Character Codex roster, sheet editor fields, and `TemplateModal` builder | `CharacterEditor.tsx`, `TemplateModal.tsx` |
| **6** | 5 | Localize Multiplayer Table Playground, Action inputs, turn lifecycle, and Host controls | `TablePlayground.tsx` |
| **7** | 5 | Localize SAO Character Orb, Character Inspector Panel, and Dice Roller | `SaoCharacterOrb.tsx`, `CharacterInspectorPanel.tsx`, `DiceRoller.tsx` |
| **8** | 6 | Adapt AI DM system instructions (`dm.ts`) for bilingual narration (`en` vs `th`) and overview schemas | `src/lib/ai/dm.ts`, `table/actions.ts` |
| **9** | 7 | Verify full workspace: TypeScript compilation (`tsc --noEmit`), ESLint (`eslint src`), and runtime language toggle tests | Workspace verification |

---

## 4. Verification Checklist

- [x] **Language Toggle Persistence**:
  - Toggling between `TH` and `EN` updates the entire UI immediately without page reload.
  - Refreshing the browser or navigating between `/hub`, `/characters`, `/campaigns`, and `/table` preserves the selected language in `localStorage` and `cookie`.
- [x] **Complete UI Coverage**:
  - No untranslated strings, hardcoded placeholders, or broken layouts in either English or Thai modes.
  - Navigation bars, Hub, Campaign Studio, Rules Builder, Character Codex, Template Customizer, SAO Orb, Inspector Panel, Party Roster, and Dice Roller fully localized.
- [x] **AI DM Bilingual Output**:
  - English table session generates immersive English narrative and English `[ Overview ]` / `[ Decision ]` prompts.
  - Thai table session generates immersive Thai narrative and Thai overview / decision prompts.
  - `extractPartyStateUpdates` regex matches both Thai and English `[ Overview ]` party status blocks seamlessly.
- [x] **Codebase Health**:
  - Zero TypeScript errors (`tsc --noEmit`).
  - Zero ESLint warnings or errors (`eslint src`).
