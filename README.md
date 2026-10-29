# 🐉 TofuTablePlay — Synchronized AI Tabletop RPG

An intelligent, real-time tabletop roleplaying platform combining **synchronized multiplayer text campaigns**, **customizable character sheet templates with shareable keys**, a **solo 3D tactical grid battle board**, **3D polyhedral dice rolling**, **dynamic multilingual lorebooks**, **full-stack bilingual localization (English & Thai)**, and an automated **AI Dungeon Master** powered by Google Gemini.

---

## 🌟 Key Features

### 1. 📜 Campaign Studio & Dynamic Lorebook (`/campaigns`)
* **World, Rule & Sheet Template Authoring:** Create, view, and edit campaigns with custom genres, world settings, overarching story briefs, specialized tabletop mechanics, and **Mandatory Character Sheet Requirements** (`/campaigns/new`, `/campaigns/[id]`, `/campaigns/[id]/edit`). Every campaign strictly binds either a built-in genre preset or a custom-designed template enforced across all tables.
* **Structured Rule Mechanics & Custom Systems Builder (`src/features/campaign/rules.ts`):** Define custom campaign rules via an interactive card-based builder (`Rule Name`, `Category / Tag`, and `Description` with dynamic add/remove controls). Rules are serialized as structured JSON with automatic backward-compatible parsing for legacy markdown/bullet lists and plain text, rendered as categorized cards on `/campaigns/[id]`, and formatted into clean Markdown bullet points (`formatRuleMechanicsForPrompt`) for the AI DM.
* **Preset Customization & Blank Sheet Canvas in Campaigns:** Preset cards offer both direct 1-click selection ("เลือกพรีเซ็ตนี้") and immediate customization ("ปรับแต่งจากพรีเซ็ต") that forks into a custom template. The Custom Template card allows generating a completely blank template canvas ("สร้างชีท Custom ว่างเปล่า") or resetting to blank ("ล้างเป็นชีทว่างใหม่").
* **Creator & Author Attribution Across Views:** Transparent attribution throughout the app—Campaign cards and detail pages showcase the campaign creator (`creator_name` / `คุณ (You)` via SSR user resolution), while Character Sheet Templates clearly attribute the template author (`template.author`) across the Campaign Hub, Campaign Details, Character Codex roster & editor header, and SAO Character Inspector.
* **Smart Lorebook Engine:** Automatically injects relevant world lore into AI DM prompts without bloating context tokens:
  * `Always Active`: Injected into every turn and opening scene.
  * `Keyword Triggered`: Scanned against recent turn history and player action drafts (automatically falls back to matching the entry's **Title** if no explicit keywords are set).
  * `Secret / DM-Only`: Hidden from regular players in the table sidebar and reserved exclusively for AI DM context (always active for the DM when keywords are left blank, or triggered on match when keywords are specified).
* **Multilingual & Symbol-Safe Matching:** Supports English, Thai (without requiring space boundaries), and special symbols (e.g., `+1 sword`, `C++`, `(blessing)`) with safe regex escaping.

### 2. 🧙‍♂️ Character Codex, Sheet Templates & SAO-Style Floating HUD Inspector (`/characters` & In-Table)
* **Reusable Character Sheets:** Build, edit, and delete persistent characters with class archetypes, appearance, backstory, strengths, weaknesses, and custom genre-specific fields.
* **Customizable Character Sheet Templates & Shareable Keys (`template.ts` & `TemplateModal.tsx`):**
  * **Built-In Genre Presets:**
    * **Classic Fantasy RPG** (`STR/DEX/CON/INT/WIS/CHA`, `HP`, `Skill Cost`, 6 armor slots).
    * **Drama & Mystery (Inventory & Clues Only)** (`builtin-drama-inventory`): 0 Resource Bars (no HP/SP), 3 narrative stats (`Reputation / Clout`, `Composure`, `Subterfuge`), 4 gear/item slots (`Attire / Disguise`, `Pockets`, `Bag / Briefcase`, `Keepsake / Badge`), social/investigative conditions (`Normal`, `Suspected`, `Favored`, `Blackmailed`, `Compromised`, `Exiled`).
    * **Romance / Slice of Life** (`Charm/Empathy/Wit/Style/Luck/Courage`, `Heart`, `Stress`, `Crush`, `Relationships`, outfit/accessory/keepsake slots).
    * **Horror Investigation** (`STR/DEX/CON/INT/Willpower/Perception`, `HP`, `Sanity`, `Luck`, firearm/clothing/pocket slots).
  * **Visual Template Builder & 0-Resource Freedom:** Customize template metadata, delete all resource bars or stats down to 0 for pure item/narrative play, add/remove custom Resource Bars (with 8 color themes and default max values), Stats/Attributes (with optional min/max clamping and default scores), Text & Bio Fields, Equipment Slots, Status Conditions, and toggle Skills/Inventory sections.
  * **Preset-to-Custom Auto-Forking:** Modifying any built-in template (e.g. `Classic Fantasy RPG`) seamlessly forks it into a standalone custom template (`[Name] (Custom)` with a unique `tpl-xxxx` ID), preserving the original preset while granting full structural freedom without schema conflicts.
  * **Blank Canvas Creation (`createEmptyTemplate`):** Start entirely from scratch with 0 resources, 0 stats, 0 equipment slots, and 0 narrative fields in Campaign Studio and Template Modal via instant "สร้างชีท Custom ว่างเปล่า" or "ล้างเป็นชีทว่าง (Start from Blank)" actions.
  * **Shareable Template Keys (`CST1.` / `CST0.`):** Export any template into a compact `deflate-raw` compressed base64url share key (`CST1....`) or plain key (`CST0....`) and import keys or raw JSON with live structure preview.
* **Combat & Resource Tracking:**
  * **HP, Skill Cost & Custom Resource Pools:** Track `Current HP / Max HP`, `Current Skill Cost / Max Skill Cost`, and any template-defined custom resource bars (`Stress`, `Luck`, etc.).
  * **Dynamic Attributes & Modifiers:** Supports classic 6 ability scores (`STR`, `DEX`, `CON`, `INT`, `WIS`, `CHA`) and custom template stats (supporting negative, zero, and positive values with automatic modifier calculation and `DiceRoller` integration).
  * **Equipment Slots & Structured Inventory Slots:** Dedicated gear slots (mapped across standard 6 slots and custom template slots) plus interactive item slots (`Item Name`, `Quantity`, optional `Description`) with dynamic add/remove controls, serialized as JSON with automatic backwards-compatible plain text fallback, and seamlessly formatted into AI DM prompt context.
  * **Custom Character Skills:** Add unlimited skills per character (`Skill Name`, `Skill Cost`, `Description`), automatically formatted into the AI DM's Party Reference Sheet.
* **SAO-Inspired Floating Circular Status Orb (`SaoCharacterOrb.tsx`):**
  * **2-Part Semicircle SVG Dial:** Displays live quick-status before expanding—**Upper Semicircle** dynamically renders the character template's resource gauges in order (dual left/right curved gauges for 2+ resources, or an expanded full upper arc for a single resource) with concentric curved `<textPath>` readouts, template color themes, and 4-tier HP color coding (`>=75%` Green, `50–74%` Yellow, `30–49%` Orange, `<30%` Red); **Lower Semicircle** dynamically divides into radial sectors for any number of template stats (`< 6`, `= 6`, or `> 6` stats with automatic font scaling and dual concentric rings when `> 8` stats).
  * **Responsive & Resizable (`[ − | 100% | + ]`):** Defaults to `280px` (`100%`, calibrated 80% baseline) on desktop and scales down automatically on tablet/mobile viewports, with fine-grained `50%–150%` resize controls saved in `localStorage` and dynamic bottom-bar clearance sync.
  * **Expandable Full-Sheet Window:** Clicking the orb plays a crystalline Web Audio chime and unfolds a translucent SAO-style inspector window containing the 2-part semicircle crest above the full template-aware character sheet, live combat editor, and instant character sheet switcher.

### 3. 🤝 Synchronized Multiplayer Tabletop (`/table/[id]`)
* **AI Opening Scene Generation:** Launching a table as **Head Table** prompts the AI DM to write a custom Turn 0 opening narration (`คำบรรยาย`) grounded in the campaign setting and active lorebook.
* **Rich Narrative Formatting & Unique Player Colors:** Renders inline Markdown (`**bold**`, `*italic*`, `` `code` ``, `~~strikethrough~~`), combat HP% & DC check badges, structured `[ Overview ]` and `[ Decision ]` tactical cards, and unique collision-free player name colors synchronized with the Party Roster (FNV-1a hash → 12-color palette with linear probing).
* **Private Turn Drafting ("Gartic Phone" Loop):** Players secretly draft actions and roll dice simultaneously without seeing teammates' choices beforehand, preventing meta-gaming.
* **Server-Synced Ready Barrier:** When every party member clicks **Ready**, a server-clock-calibrated 5-second countdown begins (`getServerTime` offset sync). If anyone un-readies, the countdown cancels immediately. Optimistic ready claims with 6-second TTL prevent badge flicker from stale realtime reloads.
* **Hybrid Realtime Architecture:** Powered by Supabase PostgreSQL Changes + low-latency Broadcast channels (`member_ready`, `table_sync`, `party_chat`) + optimistic ready claims and polling fallback.
* **Table Codes & Direct Invite Links:** Join active sessions from the Hub using a 6-character Table Code (e.g., `7K4X9B`) or a one-click copyable Invite Link (`/table/<code>`).
* **Enforced Character Sheet Compatibility & Polite Mismatch Dialog:**
  * **Table & Campaign Requirement Banners & 1-Click Character Sheet Creation:**
    * **Campaign Details (`/campaigns/[id]`):** Features an interactive Required Template card displaying resources, stats, equipment, and a direct 1-click **"สร้างตัวละครตามเทมเพลตนี้ (Create Character)"** button.
    * **Table & Character Inspector (`CharacterInspectorPanel.tsx`):** If a player enters a table without a compatible character sheet or has existing sheets that don't match, a dedicated notice banner surfaces alongside a 1-click **"สร้างตัวละครใหม่ตามเทมเพลตโต๊ะนี้"** button.
    * **Dynamic Campaign Template Auto-Loader (`getCampaignRequiredTemplate`):** Clicking these buttons navigates to `/characters?campaignId=...` or `?tableCode=...` (with `returnTo`), asynchronously fetching the campaign's exact template (built-in preset or bespoke custom template) and automatically initializing a compliant character sheet draft ready for immediate play.
  * **Polite Bilingual Mismatch Modal:** When attempting to select an incompatible character, a structured warning modal (`AlertModal` with side-by-side comparison) clearly details why the sheet cannot join, showing both the character's format vs the campaign's required template, alongside a 1-click **"สร้างตัวละครใหม่สำหรับแคมเปญนี้"** action button.
  * **Dual-Layer Compatibility Guardrails:** Mismatched sheets are visibly flagged and blocked in the UI (`⚠️ Mismatched Sheet`) with server-side validation in `linkCharacterToTable` strictly rejecting incompatible templates with localized, polite error messages.
* **Comprehensive App-Wide Input Validation:**
  * **Campaign Studio:** Validates title length (2-100 characters), world setting, core narrative, custom genre names, and attached lorebook drafts before submission.
  * **Character Codex:** Enforces non-empty character names, name length limits (max 60 characters), bounded HP/SP values, and custom stats range clamping with localized confirmation dialogs for deletion.
  * **Tabletop Gameplay:** Guards against readying up without selecting a character, restricts turn action drafts exceeding 2,500 characters, and protects table state updates.
  * **Hub & Auth:** Validates 6-character table codes and URLs with polite error feedback, plus user-friendly Thai & English auth messages for login/signup credentials.
* **Floating Party Chat Widget:** Real-time in-table chat supporting **In-Character (`IC`)** roleplay dialogue and **Out-of-Character (`OOC`)** coordination, unread counters, host badges, and Web Audio API ping notifications (80-message rolling buffer).
* **Auto-Scroll to Latest Turn & Minimal Quick-Return Symbol:** Automatically scrolls to the newest turn narration upon entering the table and when turns resolve. When scrolling up to read historical chronicle turns, a sleek floating symbol button (`CircleDot`, non-textual, without arrows) appears to quickly jump back to the bottom.

### 4. 🗺️ 3D Tactical Battle Board (`/board`) _(NOT IN ACTIVE DEVELOPMENT)_
* **Procedural Three.js Grid Maps:** Interactive 3D tabletop prototype featuring seeded maps across 3 themes (`Forest`, `Ruins`, `Dungeon`) with elevation, water/bridges, props, `MapControls` camera pan/zoom, and `5 ft`-per-tile movement reachability.
* **Party & Threat Sandbox:** Deploy multiple Codex heroes onto the grid, place custom Enemy or NPC tokens, inspect stats, adjust HP, and trigger quick ability checks.
* **Retro Visual-Novel Dialogue & Story Log:** Grapheme-accurate Thai/English typewriter `DialogueBox` (`Intl.Segmenter`) with page navigation alongside a filterable turn-by-turn `StoryLog` (`All`, `Story`, `Actions`, `Dice`).
* **Structured JSON AI DM:** Evaluates token coordinates, distances to nearest opponents, and dice rolls to return structured JSON (`narration`, `scene`, `rolls`, `hpChanges`, `spawns`, `defeated`) that automatically updates board tokens and persists session progress in `localStorage`.

### 5. 🎲 3D Polyhedral Dice Roller (`src/components/dice/`)
* **Interactive 3D Dice Tray:** Three.js-rendered polyhedral dice (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`) with tumbling animation and critical hit / critical fail visual highlights.
* **Full Tabletop Modifiers:** Supports multi-dice pools, flat modifiers, character ability score & custom template stat bonuses, `Normal` / `Advantage` / `Disadvantage` modes, and optional `DC` target checks.
* **Seamless Action Integration:** Automatically appends formatted roll results into the player's action draft in Multiplayer Table mode or logs pending roll outcomes for the DM in Battle Board mode.

### 6. 🔊 Event & Dice Notification Audio (`src/lib/sound.ts`)
* **Contextual Sound Effects:** Autoplay-safe audio notifications (`public/assets/sound/`) triggered across gameplay events:
  * **Dice Roll Tiers:** `< 10` (`roll_under_10.wav`), `10–14` (`roll_more_than_10_under_15.wav`), and `>= 15` (`roll_more_than_15.wav`).
  * **System Events:** Player entering table (`player_enter_table.wav`), new AI DM turn narration (`Ai_reply.wav`), and error alerts (`error.wav`).

### 7. 🤖 AI Dungeon Master Engine (`src/lib/ai/dm.ts`)
* **Genre-Driven Rules Profiles (Template Mechanics Schema v2):** Character sheet templates now include first-class `mechanics: { mode, vitalityResourceId, dice, statModifier }`, allowing campaigns and tables to natively support four distinct genres:
  * **Combat RPG (`combat`):** Full tabletop combat engine with the **Flat Damage Benchmark System** (Graze: 5–10%, Normal: 15–25%, Heavy: 30–45% of average party Max HP), defense mitigation (resilience stat + armor pieces), anti-one-shot monster pacing, and enemy HP% tracking in `[ Overview ]`.
  * **Social & Romance (`social`):** Focuses on emotional dynamics, personal chemistry, conversational tension, and social hierarchy. Replaces physical HP damage with emotional resource adjustments (`(Name — Heart: 8/10 -> 6/10 [-2 Heart])`, `(Name — Stress: 2/5 -> 4/5 [+2 Stress])`) and social conditions (`Flustered`, `Captivated`, `Heartbroken`, `Distrusted`).
  * **Horror & Survival (`horror`):** Atmosphere of dread, claustrophobic pacing, and enigmatic cosmic threats. Resolves psychological tension via panic checks, mental stability adjustments (`(Name — Sanity: 45/50 -> 36/50 [-9 Sanity])`), and psychological conditions (`Panicked`, `Catatonic`, `Hallucinating`, `Shaken`).
  * **Narrative & Mystery (`narrative`):** For investigative or 0-resource sheets (e.g. `Drama & Mystery`), combat HP and monster HP% are turned off completely. The AI DM resolves challenges through **Item Depletion & Gain** (`[-1 Flashlight]`, `[+1 Old Key]`), clues, and investigative conditions (`Suspected`, `Compromised`, `Exhausted`).
* **Multi-Dice & Custom Modifier Engine:**
  * **Dice Systems (`dice`):** Supports `d20` (standard DC checks: 8–10 easy, 12–14 medium, 15–17 hard), `2d6` (PbtA style: 7–9 partial success, 10+ full success), `d100` (Call of Cthulhu roll-under), and `none` (pure narrative choices without dice).
  * **Stat Modifier Formulas (`statModifier`):** Supports `dnd` (standard D&D 5e: `(score - 10) / 2`), `raw` (direct stat bonus: `+score` for 1–5 or ±3 scales), and `none` (no roll bonus: `+0`).
  * **Dice Tray Integration:** The 3D Dice Tray automatically initializes with the player's character sheet dice type (e.g. 2d6 or d100) and ability modifiers calculated using their template's formula.
* **Modular AI DM Prompting & Dynamic `[ Overview ]` / `[ Decision ]`:**
  * The system instruction decomposes into isolated rule modules (`CORE`, `COMBAT`, `SOCIAL`, `HORROR`, `NARRATIVE_ITEMS`).
  * `[ Overview ]` dynamically swaps middle lines: `สถานะศัตรู` (Combat), `บรรยากาศและความรู้สึก` (Social), `ระดับความตึงเครียดและสิ่งคุกคาม` (Horror), or `สิ่งของสำคัญและเบาะแส` (Narrative).
  * `[ Decision ]` dynamically crafts next-turn prompts adhering strictly to each individual character's dice system and available stats.
* **Clean Prompt Sanitization & Structured Rule Formatting:** Automatically strips embedded `<!-- CAMPAIGN_TEMPLATE: {...} -->` metadata comments (`stripCampaignTemplateFromRules`) and formats structured JSON/legacy campaign rules into clean bulleted Markdown (`formatRuleMechanicsForPrompt`) before prompting Gemini across turn generation, opening scene creation, and battle board turns, keeping context windows lightweight and preventing model confusion.
* **Immersion-First Dice Invisibility:** Translates player dice rolls (SUCCESS, FAIL, NATURAL 20, NATURAL 1) strictly into dramatic in-world narrative events, forbidding the AI from breaking immersion by reciting raw roll numbers, dice types, or phrases like "ทอยได้ 18" in prose.
* **Template-Aware Character Context:** Dynamically builds system instructions, `[ Decision ]` stat prompts, and `[ Overview ]` status schemas from the party's active templates—formatting all template stats, resource bars (`HP`, `Heart`, `Skill Cost`, `Sanity`, `Stress`, `Luck`, etc.), equipment slots, allowed conditions, and text/bio fields.
* **Automatic State Extraction:** Parses AI narrative output for named inline resource changes (`(Shacco — HP: 100/100 -> 80/100 [-20 HP])`, `(Shacco — Skill Cost: 10/10 -> 7/10 [-3 SP])`, `(Shacco — Sanity: 50/50 -> 42/50 [-8])`, etc.) and authoritative single-line/multi-line `[ Overview ]` `สถานะปาร์ตี้` blocks using longest-name-first matching and resource alias resolution so all built-in and custom template resources auto-sync to Supabase without mixing up players. Also supports custom template conditions, Thai→English condition mapping, and guards low-vitality condition thresholds (`Bloodied`, `Unconscious`) from misfiring on 0-resource characters.
* **Bounded Sliding-Window History & Anti-Repetition:** Maintains the last 4 turns as multi-turn conversation history for token efficiency while preventing repeated phrasing or overriding unsubmitted player agency.
* **Host Narrative Override & Atomic Locking:** Head Table hosts can edit any turn's narrative output in place, while atomic database phase transitions (`turn_phase: 'resolving'`) prevent duplicate AI executions.

### 8. 🌐 Full-Stack Bilingual Localization (English & Thai) (`src/lib/i18n/`)
* **Lightweight Reactive Core & Dictionaries (`src/lib/i18n/`):** Built-in zero-dependency localization engine with strictly typed translation schema (`Language`, `Translations`) and comprehensive Thai and English dictionaries (`th.ts`, `en.ts`) covering all domains (`common`, `nav`, `hub`, `campaign`, `character`, `table`, `sao`, `dice`, `dm`).
* **Universal Persistence & SSR Synchronization (`LanguageContext.tsx`):** Managed via `LanguageProvider` and `useLanguage()` hook with dynamic parameter replacement (`t('path.to.key', { param: 'value' })`), immediate UI reactivity without page reloads, client `localStorage` persistence, multi-tab `storage` synchronization, and cookie persistence (`tofu_language`) for seamless SSR hydration.
* **Instant Language Switcher (`LanguageToggle.tsx`):** A sleek, compact toggler (`🇹🇭 TH | 🇺🇸 EN`) embedded conveniently in the global navigation headers across the **Campaign Hub**, **Campaign Details & Studio**, **Character Codex**, and in-table **SAO Navigation Bar**.
* **End-to-End Bilingual Interface Coverage:**
  * **Campaign Studio & Rules Builder:** Localized form controls, category pickers, lorebook activation modes, template requirement cards, and custom rules builder.
  * **Character Codex & Template Modal:** Localized identity fields, stats clamping, equipment slots, skill manager, inventory editor, and template customization tabs.
  * **In-Game SAO HUD & Inspector Panel:** Localized player status badges, dial gauge tooltips, inline combat editor, compatibility warnings, and character switcher.
  * **Party Roster & 3D Dice Roller:** Localized party status badges, declared action previews, lorebook entries, and 3D dice tray controls (`Dice`, `Modifier`, `Mode`, `Adv/Dis`, `Roll`).
* **Bilingual AI Dungeon Master Engine (`src/lib/ai/dm.ts`):**
  * **Dynamic Language Directives:** When toggled to English, Gemini is explicitly instructed to narrate the adventure, compose character dialogues, and format structured tactical cards (`[ Overview ]` with `Location & Time`, `Current Situation`, `Enemy Status`, `Party Status` and `[ Decision ]` with real sheet stats and DC checks) entirely in fluent, atmospheric English. When set to Thai, rich Thai tabletop RPG prose is maintained.
  * **Bilingual Opening Scene Generation (`generateOpeningNarrative`):** Automatically initializes new tables with an opening prologue tailored to the creator's active language preference.
  * **Resilient Dual-Language State Extraction:** `extractPartyStateUpdates` regex dynamically matches both Thai (`สถานะปาร์ตี้ :`) and English (`Party Status :`) overview blocks, ensuring automated HP, Skill Cost (SP), and custom resource syncing works flawlessly in both languages.

### 9. 🛡️ Authentication, Security & Room Governance
* **Supabase Auth & 6-Hour Idle Session:** Email/password authentication. Supabase auth cookies expire 6 hours after their last refresh, so an idle session ends after 6 hours. `src/middleware.ts` redirects signed-out users from protected routes to `/login` with post-login route restoration (`?next=...`).
* **Room & Campaign Governance:** Head Table member kick controls, player `Leave Table` support, custom confirmation/status modals (`AlertModal`), and cascading cleanup when deleting tables or campaigns.

---

## 🛠️ Tech Stack

* **Framework:** [Next.js 16.4](https://nextjs.org/) (App Router, Turbopack, Server Actions, Partial Prefetching)
* **Frontend:** [React 19.3](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/), [Tailwind CSS 4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
* **3D Graphics:** [Three.js](https://threejs.org/) (`three` `^0.186.1`)
* **Database, Auth & Realtime:** [Supabase](https://supabase.com/) (`@supabase/ssr`, `@supabase/supabase-js`, PostgreSQL Realtime & Broadcast)
* **AI Engine:** [Google Gemini](https://ai.google.dev/) (`@google/genai` — `gemini-3.5-flash-lite`, temperature `0.7`)
* **Package Manager / Runtime:** [Bun](https://bun.sh/) `1.3.1` (or Node.js `v20+` with `npm`)

---

## 🚀 Getting Started

### 1. Prerequisites
* [Bun](https://bun.sh/) (v1.2+) or [Node.js](https://nodejs.org/) (v20+)
* A [Supabase](https://supabase.com/) project with PostgreSQL Database, Realtime (`tables`, `table_members`, `turns`), and Email Authentication enabled
* A [Google Gemini API Key](https://aistudio.google.com/)

### 2. Environment Variables
Create a `.env` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-gemini-api-key
```

> **Note:** `SUPABASE_SERVICE_ROLE_KEY` is used exclusively on the server (`createAdminClient()`) for authorized cross-row operations such as reading campaign lorebooks for AI DM prompt injection, syncing party rosters, and cascading table/campaign deletions.

### 3. Core Supabase Tables
Ensure your Supabase `public` schema includes the following tables:

| Table | Key Columns | Purpose |
| :--- | :--- | :--- |
| `campaigns` | `id`, `creator_id`, `title`, `category`, `world_setting`, `core_description`, `rule_mechanics` | Campaign metadata & rule definitions |
| `lorebook_entries` | `id`, `campaign_id`, `title`, `category`, `activation_mode`, `trigger_keys[]`, `content` | Campaign lore entries with activation modes |
| `characters` | `id`, `user_id`, `name`, `class_archetype`, `current_hp`, `max_hp`, `armor_class`, `status_condition`, `stats` (JSONB), `appearance`, `inventory`, `equipment`, `strengths`, `weaknesses`, `backstory` | Player character sheets |
| `tables` | `id`, `table_code`, `campaign_id`, `head_table_id`, `current_turn`, `turn_phase`, `countdown_end` | Active multiplayer sessions |
| `table_members` | `id`, `table_id`, `user_id`, `character_id`, `is_ready`, `joined_at` | Connected party members |
| `turns` | `id`, `table_id`, `turn_number`, `narrative_output`, `edited_by_host` | Turn-by-turn AI DM narrative |
| `turn_actions` | `turn_id`, `member_id`, `action_text` (unique on `turn_id`, `member_id`) | Player action drafts per turn |

**Notable structured campaign rule mechanics JSON structure (stored in `campaigns.rule_mechanics` with legacy markdown/plain-text fallback):**
```json
[
  { "id": "rule-1", "title": "Sanity Meter", "category": "Horror", "description": "Failing a panic check reduces Sanity by 1d6." },
  { "id": "rule-2", "title": "Clue Deduction", "category": "Investigation", "description": "Combining 3 clues reveals the culprit's motive." }
]
```

**Notable structured inventory JSON structure (stored in `characters.inventory` with plain-text fallback):**
```json
[
  { "name": "Health Potion", "quantity": 2, "description": "Restores 20 HP" },
  { "name": "Rope", "quantity": 1, "description": "50ft hempen rope" }
]
```

**Notable `characters.stats` JSONB structure (supports custom sheet templates & custom values):**
```json
{
  "STR": 10, "DEX": 14, "CON": 12, "INT": 8, "WIS": 13, "CHA": 16,
  "current_skill_cost": 7,
  "max_skill_cost": 10,
  "skills": [{ "name": "Fireball", "cost": 3, "description": "Area damage" }],
  "sheet_template": {
    "v": 2,
    "id": "builtin-romance",
    "name": "Romance / Slice of Life",
    "mechanics": { "mode": "social", "vitalityResourceId": "hp", "dice": "d20", "statModifier": "raw" },
    "...": "..."
  },
  "sheet_custom": {
    "stats": { "charm": 14, "wit": 12 },
    "resources": { "stress": { "current": 2, "max": 10 } },
    "fields": { "crush": "Childhood friend" },
    "equipment": { "outfit": "School Uniform" }
  }
}
```

### 4. Installation & Development

```bash
# Install dependencies (Bun or npm)
bun install
# or: npm install

# Start the development server
bun run dev
# or: npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Available Scripts

| Command | Description |
| :--- | :--- |
| `bun run dev` / `npm run dev` | Start Next.js development server with Turbopack |
| `bun run build` / `npm run build` | Build production bundle |
| `bun run start` / `npm run start` | Run production Next.js server |
| `bun run lint` / `npm run lint` | Run ESLint across the codebase |

---

## 🔄 Multiplayer Turn Lifecycle

```text
┌──────────────────────────────────────────────────────────────┐
│  1. Players select characters, enter table                   │
│  2. AI generates Turn 0 opening narration                    │
│     (generateOpeningNarrative — 15s timeout)                 │
│                                                              │
│  ┌─────────── TURN LOOP ──────────────────────────────────┐  │
│  │  3. Players secretly draft actions + roll dice          │  │
│  │     ("Gartic Phone" — no peeking)                       │  │
│  │  4. All players click Ready                             │  │
│  │     → 5-second server-synced countdown                  │  │
│  │  5. Atomic lock (turn_phase → 'resolving')              │  │
│  │  6. resolveTurn() gathers:                              │  │
│  │     • All player action drafts                          │  │
│  │     • Triggered lorebook entries                        │  │
│  │     • Last 4 turns as conversation history              │  │
│  │  7. generateDmNarrative() calls Gemini                  │  │
│  │     • Full party stats, template fields & active mode   │  │
│  │       (Combat damage benchmarks or 0-resource narrative)│  │
│  │  8. extractPartyStateUpdates() auto-applies:            │  │
│  │     • HP/SP changes parsed from narrative               │  │
│  │     • Condition mapping (Template & Thai → English)     │  │
│  │     • Bloodied/Unconscious thresholds                   │  │
│  │  9. New turn persisted, ready states reset → step 3     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  Realtime Sync:                                              │
│  • Supabase postgres_changes on tables/table_members/turns   │
│  • Broadcast: member_ready, table_sync, party_chat           │
│  • Server clock offset sync for countdown accuracy           │
│  • Optimistic ready claims (6s TTL) prevent badge flicker    │
└──────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Architecture

```text
├── public/
│   └── assets/sound/                     # WAV sound notifications (dice roll tiers, enter, AI reply, error)
└── src/
    ├── middleware.ts                     # Auth route protection & /login redirects (must live in src/)
    ├── app/                              # Pure Routing Layer (Pages, Layouts & Route Handlers only)
    │   ├── layout.tsx                    # Root layout with Geist fonts & global AlertProvider
    │   ├── page.tsx                      # Landing page
    │   ├── globals.css                   # Tailwind CSS 4 global styles
    │   ├── auth/callback/route.ts        # Supabase OAuth / email confirmation callback handler
    │   ├── login/page.tsx                # Sign In / Sign Up screen
    │   ├── hub/page.tsx                  # Campaign Hub server route
    │   ├── characters/page.tsx           # Character Codex server route
    │   ├── campaigns/                    # Campaign Studio routes
    │   │   ├── new/page.tsx              # Create new campaign route
    │   │   └── [id]/                     # Campaign details ([id]/page.tsx) & owner edit ([id]/edit/page.tsx)
    │   ├── table/[id]/page.tsx           # Multiplayer Tabletop route (supports UUID or 6-char table_code)
    │   └── board/page.tsx                # Solo 3D Tactical Battle Board route (NOT IN ACTIVE DEV)
    │
    ├── features/                         # Domain-Driven Feature Modules
    │   ├── table/                        # Synchronized Multiplayer Tabletop
    │   │   ├── actions.ts                # Ready barrier, atomic AI turn resolution, combat sheet updates, kick
    │   │   ├── countdown.ts              # Synchronized ready countdown constants (COUNTDOWN_MS = 5000)
    │   │   ├── types.ts                  # Domain types, 12-color player palette, optimistic ready claims & FNV-1a hashing
    │   │   ├── hooks.ts                  # TablePlayground hooks (notification sounds, server clock offset, ready countdown)
    │   │   └── components/
    │   │       ├── TablePlayground.tsx         # Realtime sync coordinator, clock offset & turn lifecycle
    │   │       ├── NarrativeFeedPanel.tsx      # Rich-formatted turn chronicle, player colors, action input & DiceRoller
    │   │       ├── NarrativeFormatting.tsx     # Formatted narrative output & player-name highlighting
    │   │       ├── SaoCharacterOrb.tsx         # Responsive 2-part semicircle SAO status orb with curved SVG text & +/- resize
    │   │       ├── SaoDualSemicircleDial.tsx   # SVG dual semicircle dial used by the SAO orb
    │   │       ├── CharacterInspectorPanel.tsx # Expandable SAO character window, template-aware combat editor & switcher
    │   │       ├── CharacterSheetView.tsx      # Read-only sheet sections inside the inspector
    │   │       ├── CharacterCombatEditor.tsx   # Inline HP / resource / condition editor
    │   │       ├── CharacterSelectorList.tsx   # Character switcher with template-compatibility flags
    │   │       ├── PartyRosterSidebar.tsx      # Floating top-right in-game HUD (transparent BG) for party status & campaign lore
    │   │       └── PartyChatWidget.tsx         # Floating IC/OOC realtime party chat with audio ping (80-msg buffer)
    │   ├── character/                    # Character Codex & Shared Character Domain
    │   │   ├── domain.ts                 # Shared stat/skill/equipment/inventory constants, sanitizers & HP color helpers
    │   │   ├── template.ts               # Built-in presets (Classic, Drama, Romance, Horror), sanitizers, blank canvas & CST1./CST0. codec
    │   │   ├── actions.ts                # Create, update, delete character sheets & getCampaignRequiredTemplate resolver
    │   │   └── components/
    │   │       ├── CharacterCodexHeader.tsx # Character Codex header with LanguageToggle & navigation
    │   │       ├── CharacterEditor.tsx   # Template-driven sheet editor (auto-forking presets, async campaign loader, dynamic stats & equipment)
    │   │       ├── CharacterRoster.tsx   # Saved-sheet list sidebar
    │   │       ├── CharacterSheetSections.tsx # Editor sections (identity, resources, stats, equipment, skills, inventory)
    │   │       ├── TemplateModal.tsx     # Visual template customizer, preset-to-custom forking, blank reset, CST1. exporter & importer
    │   │       ├── TemplateBuilderTab.tsx # Template builder tab (stats, resources, text fields, equipment slots, mechanics)
    │   │       └── TemplateKeyTabs.tsx   # CST1. export / import tabs
    │   ├── campaign/                     # Campaign Studio & Lorebook Authoring
    │   │   ├── actions.ts                # Create & update campaigns (with strict template binding validation) and lorebook entries
    │   │   ├── rules.ts                  # Structured rule mechanics parser, JSON serializer & AI prompt formatter
    │   │   └── components/
    │   │       ├── CampaignDetailsClient.tsx # Localized campaign details view, requirements & table launcher
    │   │       ├── CampaignForm.tsx      # Shared campaign authoring form (state, submit & section layout)
    │   │       ├── CampaignFoundationSection.tsx # Title, genre, world setting & structured rule builder
    │   │       ├── CampaignTemplatePicker.tsx    # Required character template picker & preset customization
    │   │       └── CampaignLorebookEditor.tsx    # Lorebook registry editor (useLorebookDraft)
    │   ├── hub/                          # Campaign Hub & Session Management
    │   │   ├── actions.ts                # Launch table (with AI opening scene), join, leave, delete, sign out
    │   │   ├── types.ts                  # Hub view types (PublicCampaign, ActiveTable)
    │   │   └── components/
    │   │       ├── HubHeader.tsx         # Hub navigation header with LanguageToggle & brand
    │   │       ├── HubClient.tsx         # Hub page layout & state
    │   │       ├── QuickJoinBar.tsx      # Quick Join by table code or invite link
    │   │       ├── HubCards.tsx          # Active table & campaign cards
    │   │       └── CampaignCarousel.tsx  # Campaign carousel
    │   └── board/                        # Solo 3D Tactical Battle Board (NOT IN ACTIVE DEV)
    │       ├── actions.ts                # Server Action bridging board turns & lorebooks to Gemini
    │       ├── lib/                      # Seeded map generator (maps.ts), session.ts, turn.ts, types.ts, utils.ts
    │       └── components/               # BoardLoader, BoardPlayground, BoardScene, BoardPanels, DialogueBox, StoryLog
    │
    ├── components/                       # Shared Reusable UI & Widgets
    │   ├── dice/                         # Reusable 3D Polyhedral Dice System
    │   │   ├── DiceRoller.tsx            # Dice tray UI (d4–d100, modifiers, actor stats, Adv/Disadv, DC)
    │   │   ├── Die3D.tsx                 # Three.js 3D polyhedral mesh & roll animation
    │   │   ├── dice.ts                   # Pure dice math (crypto RNG), ability modifiers & roll formatters
    │   │   └── index.ts                  # Barrel exports
    │   └── ui/
    │       ├── AlertModal.tsx            # Global modal & confirmation dialog context (useAlert, showConfirm)
    │       └── LanguageToggle.tsx        # 🇹🇭 TH / 🇺🇸 EN bilingual language switcher
    │
    └── lib/                              # Core Infrastructure & Cross-Cutting Services
        ├── sound.ts                      # Autoplay-resilient dice & system sound notification player
        ├── turns.ts                      # Opening narration turn index constant (OPENING_TURN_NUMBER = 1)
        ├── i18n/                         # Full-stack bilingual localization system (English & Thai)
        │   ├── types.ts                  # Typed translation schema & dictionary interface
        │   ├── LanguageContext.tsx       # Reactive language context, localStorage & cookie sync
        │   └── locales/                  # Localized dictionaries (th.ts, en.ts)
        ├── ai/
        │   ├── dm.ts                     # Multiplayer AI DM orchestrator (turn & opening scene generation, re-exports)
        │   ├── dmTypes.ts                # DM turn input, party member & state-update types
        │   ├── dmParty.ts                # Party sheet prompt formatting, resource descriptors & damage benchmark
        │   ├── dmPrompt.ts               # System instruction rule modules, [ Overview ] / [ Decision ] schemas & turn messages
        │   ├── dmStateExtraction.ts      # extractPartyStateUpdates: parse resource/condition changes from narration
        │   ├── boardDm.ts                # Battle Board JSON AI DM: prompt builder & safe reply parser
        │   └── lorebook.ts               # Multilingual keyword/title scanner & DM-only lore filter
        └── supabase/
            ├── client.ts                 # Browser Supabase client (6-hour cookie maxAge)
            ├── server.ts                 # SSR cookie client & Service Role admin client
            └── auth.ts                   # Shared requireAuthenticatedUser() guard, UUID_REGEX & DB client types
```

---

## 📊 Route Map

| Route | Auth | Description |
| :--- | :--- | :--- |
| `/` | ✗ | Landing page with official brand logo, hero section, CTA buttons, and 3-pillar feature grid |
| `/login` | ✗ | Sign In / Sign Up (floating frosted glass card with language switch) |
| `/auth/callback` | ✗ | Supabase OAuth / email confirmation handler |
| `/hub` | ✓ | Campaign Hub — browse campaigns, manage active tables, Quick Join |
| `/campaigns/new` | ✓ | Create new campaign with mandatory template and lorebook |
| `/campaigns/[id]` | ✓ | Campaign detail view & table launcher |
| `/campaigns/[id]/edit` | ✓ | Edit campaign (owner only) |
| `/characters` | ✓ | Character Codex — template-driven sheet editor workspace |
| `/table/[id]` | ✓ | Synchronized Multiplayer Table (SAO orb, narrative chronicle, chat) |
| `/board` | ✓ | Solo 3D Tactical Battle Board _(not in active dev)_ |

---

## 🎨 UI & Design System

The application features a modern, distraction-free **Swiss Dark / Minimalist Dark** design system utilizing layered opacity surfaces (`backdrop-blur-md`, subtle alpha channels), smooth fade micro-interactions, matte amber accents, and zero glare/neon bloom.

👉 See [website_ui.md](website_ui.md) for full design system tokens, surface hierarchy, and component specifications.
