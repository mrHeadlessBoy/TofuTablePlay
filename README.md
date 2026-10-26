# 🐉 TofuTablePlay — Synchronized AI Tabletop RPG

An intelligent, real-time tabletop roleplaying platform combining **synchronized multiplayer text campaigns**, **customizable character sheet templates with shareable keys**, a **solo 3D tactical grid battle board**, **3D polyhedral dice rolling**, **dynamic multilingual lorebooks**, and an automated **AI Dungeon Master** powered by Google Gemini.

---

## 🌟 Key Features

### 1. 📜 Campaign Studio & Dynamic Lorebook (`/campaigns`)
* **World & Rule Authoring:** Create, view, and edit campaigns with custom genres, world settings, overarching story briefs, and specialized tabletop mechanics (`/campaigns/new`, `/campaigns/[id]`, `/campaigns/[id]/edit`).
* **Smart Lorebook Engine:** Automatically injects relevant world lore into AI DM prompts without bloating context tokens:
  * `Always Active`: Injected into every turn and opening scene.
  * `Keyword Triggered`: Scanned against recent turn history and player action drafts (automatically falls back to matching the entry's **Title** if no explicit keywords are set).
  * `Secret / DM-Only`: Hidden from regular players in the table sidebar and reserved exclusively for AI DM context (always active for the DM when keywords are left blank, or triggered on match when keywords are specified).
* **Multilingual & Symbol-Safe Matching:** Supports English, Thai (without requiring space boundaries), and special symbols (e.g., `+1 sword`, `C++`, `(blessing)`) with safe regex escaping.

### 2. 🧙‍♂️ Character Codex, Sheet Templates & SAO-Style Floating HUD Inspector (`/characters` & In-Table)
* **Reusable Character Sheets:** Build, edit, and delete persistent characters with class archetypes, appearance, backstory, strengths, weaknesses, and custom genre-specific fields.
* **Customizable Character Sheet Templates & Shareable Keys (`template.ts` & `TemplateModal.tsx`):**
  * **Built-In Genre Presets:** Switch between **Classic Fantasy RPG** (`STR/DEX/CON/INT/WIS/CHA`, `HP`, `Skill Cost`, 6 armor slots), **Romance / Slice of Life** (`Charm/Empathy/Wit/Style/Luck/Courage`, `Composure`, `Social Energy`, `Stress`, `Crush`, `Relationships`, outfit/accessory/keepsake slots), and **Horror Investigation** (`Physique/Nerves/Observation/Occult/Willpower/Luck`, `Health`, `Sanity`, `Luck`, `Phobia / Trauma`).
  * **Visual Template Builder:** Customize template metadata, add/remove Resource Bars (with 8 color themes and default max values), Stats/Attributes (with optional min/max clamping and default scores), Text & Bio Fields, Equipment Slots, Status Conditions, and toggle Skills/Inventory sections.
  * **Shareable Template Keys (`CST1.` / `CST0.`):** Export any template into a compact `deflate-raw` compressed base64url share key (`CST1....`) or plain key (`CST0....`) and import keys or raw JSON with live structure preview.
* **Combat & Resource Tracking:**
  * **HP, Skill Cost & Custom Resource Pools:** Track `Current HP / Max HP`, `Current Skill Cost / Max Skill Cost`, and any template-defined custom resource bars (`Stress`, `Luck`, etc.).
  * **Dynamic Attributes & Modifiers:** Supports classic 6 ability scores (`STR`, `DEX`, `CON`, `INT`, `WIS`, `CHA`) and custom template stats (supporting negative, zero, and positive values with automatic modifier calculation and `DiceRoller` integration).
  * **Equipment Slots & Structured Inventory Slots:** Dedicated gear slots (mapped across standard 6 slots and custom template slots) plus interactive item slots (`Item Name`, `Quantity`, optional `Description`) with dynamic add/remove controls, serialized as JSON with automatic backwards-compatible plain text fallback, and seamlessly formatted into AI DM prompt context.
  * **Custom Character Skills:** Add unlimited skills per character (`Skill Name`, `Skill Cost`, `Description`), automatically formatted into the AI DM's Party Reference Sheet.
* **SAO-Inspired Floating Circular Status Orb (`SaoCharacterOrb.tsx`):**
  * **2-Part Semicircle SVG Dial:** Displays live quick-status before expanding—**Upper Semicircle** features dual gauges with concentric curved `<textPath>` readouts for the template's primary resources (`HP` and `SKILL PT`) with 4-tier HP color coding (`>=75%` Green, `50–74%` Yellow, `30–49%` Orange, `<30%` Red); **Lower Semicircle** displays the character's template stats across radial sectors.
  * **Responsive & Resizable (`[ − | 100% | + ]`):** Defaults to `280px` (`100%`, calibrated 80% baseline) on desktop and scales down automatically on tablet/mobile viewports, with fine-grained `50%–150%` resize controls saved in `localStorage` and dynamic bottom-bar clearance sync.
  * **Expandable Full-Sheet Window:** Clicking the orb plays a crystalline Web Audio chime and unfolds a translucent SAO-style inspector window containing the 2-part semicircle crest above the full template-aware character sheet, live combat editor, and instant character sheet switcher.

### 3. 🤝 Synchronized Multiplayer Tabletop (`/table/[id]`)
* **AI Opening Scene Generation:** Launching a table as **Head Table** prompts the AI DM to write a custom Turn 0 opening narration (`คำบรรยาย`) grounded in the campaign setting and active lorebook.
* **Rich Narrative Formatting & Unique Player Colors:** Renders inline Markdown (`**bold**`, `*italic*`, `` `code` ``, `~~strikethrough~~`), combat HP% & DC check badges, structured `[ Overview ]` and `[ Decision ]` tactical cards, and unique collision-free player name colors synchronized with the Party Roster (FNV-1a hash → 12-color palette with linear probing).
* **Private Turn Drafting ("Gartic Phone" Loop):** Players secretly draft actions and roll dice simultaneously without seeing teammates' choices beforehand, preventing meta-gaming.
* **Server-Synced Ready Barrier:** When every party member clicks **Ready**, a server-clock-calibrated 5-second countdown begins (`getServerTime` offset sync). If anyone un-readies, the countdown cancels immediately. Optimistic ready claims with 6-second TTL prevent badge flicker from stale realtime reloads.
* **Hybrid Realtime Architecture:** Powered by Supabase PostgreSQL Changes + low-latency Broadcast channels (`member_ready`, `table_sync`, `party_chat`) + optimistic ready claims and polling fallback.
* **Table Codes & Direct Invite Links:** Join active sessions from the Hub using a 6-character Table Code (e.g., `7K4X9B`) or a one-click copyable Invite Link (`/table/<code>`).
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
* **Flat Damage Benchmark System:** Computes party-wide damage tiers from the average Max HP of all active characters:
  * **Graze:** 5–10% of avg Max HP
  * **Normal:** 15–25% of avg Max HP
  * **Heavy:** 30–45% of avg Max HP
* **Per-Character Defense Mitigation:** Calculates damage reduction from CON modifier + equipped armor piece count (max 15% of avg Max HP cap), injected into each character's stat block for the AI DM.
* **Template-Aware Character Context:** Formats both classic and custom template stats, custom resource bars (`Stress`, `Luck`, etc.), custom equipment slots, and custom text/bio fields into the AI DM prompt.
* **Balanced Combat & Enemy HP% Scaling:** Enforces anti-one-shot damage scaling, tracks enemy health percentages in `[ Overview ]`, and outputs conditional `[ Decision ]` DC prompts only when meaningful obstacles or risks are present.
* **Automatic State Extraction:** Parses AI narrative output for inline HP changes (`(HP: 100/100 -> 80/100 [-20 HP])`), Skill Cost changes (`(Skill Cost: 10/10 -> 7/10 [-3 SP])`), custom template conditions, and Thai→English condition mapping (e.g., `มึนงง` → `Stunned`). Auto-applies Bloodied (HP <= 30%) and Unconscious (HP = 0) thresholds with 4-tier HP status colors (>=75% Green, 50–74% Yellow, 30–49% Orange, <30% Red).
* **Bounded Sliding-Window History & Anti-Repetition:** Maintains the last 4 turns as multi-turn conversation history for token efficiency while preventing repeated phrasing or overriding unsubmitted player agency.
* **Host Narrative Override & Atomic Locking:** Head Table hosts can edit any turn's narrative output in place, while atomic database phase transitions (`turn_phase: 'resolving'`) prevent duplicate AI executions.

### 8. 🛡️ Authentication, Security & Room Governance
* **Supabase Auth & 6-Hour Session Guard:** Email/password authentication with middleware-enforced 6-hour session expiration (`dnd_session_start` cookie) and post-login route restoration (`?next=...`).
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
  "sheet_template": { "v": 1, "id": "builtin-romance", "name": "Romance / Slice of Life", "..." : "..." },
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
│  │     • Full party stats + template fields + benchmarks   │  │
│  │     • Per-character defense mitigation                  │  │
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
├── middleware.ts                         # Auth route protection & 6-hour session timeout guard
├── public/
│   └── assets/sound/                     # WAV sound notifications (dice roll tiers, enter, AI reply, error)
└── src/
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
    │   │   └── components/
    │   │       ├── TablePlayground.tsx         # Realtime sync coordinator, clock offset & turn lifecycle
    │   │       ├── NarrativeFeedPanel.tsx      # Rich-formatted turn chronicle, player colors, action input & DiceRoller
    │   │       ├── SaoCharacterOrb.tsx         # Responsive 2-part semicircle SAO status orb with curved SVG text & +/- resize
    │   │       ├── CharacterInspectorPanel.tsx # Expandable SAO character window, template-aware combat editor & switcher
    │   │       ├── PartyRosterSidebar.tsx      # Floating top-right in-game HUD (transparent BG) for party status & campaign lore
    │   │       └── PartyChatWidget.tsx         # Floating IC/OOC realtime party chat with audio ping (80-msg buffer)
    │   ├── character/                    # Character Codex & Shared Character Domain
    │   │   ├── domain.ts                 # Shared stat/skill/equipment/inventory constants, sanitizers & HP color helpers
    │   │   ├── template.ts               # Built-in presets (Classic, Romance, Horror), template sanitizers & CST1./CST0. key codec
    │   │   ├── actions.ts                # Create, update & delete character sheets
    │   │   └── components/
    │   │       ├── CharacterEditor.tsx   # Template-driven sheet editor (resources, stats, bio fields, equipment, inventory & skills)
    │   │       └── TemplateModal.tsx     # Visual template customizer, CST1. share key exporter & key/JSON importer
    │   ├── campaign/                     # Campaign Studio & Lorebook Authoring
    │   │   ├── actions.ts                # Create & update campaigns and lorebook entries
    │   │   └── components/
    │   │       └── CampaignForm.tsx      # Shared campaign & dynamic lorebook authoring form
    │   ├── hub/                          # Campaign Hub & Session Management
    │   │   ├── actions.ts                # Launch table (with AI opening scene), join, leave, delete, sign out
    │   │   └── components/
    │   │       └── HubClient.tsx         # Quick Join (Code/Invite Link), Active Tables & Campaign carousel
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
    │       └── AlertModal.tsx            # Global modal & confirmation dialog context (useAlert, showConfirm)
    │
    └── lib/                              # Core Infrastructure & Cross-Cutting Services
        ├── sound.ts                      # Autoplay-resilient dice & system sound notification player
        ├── turns.ts                      # Opening narration turn index constant (OPENING_TURN_NUMBER = 1)
        ├── ai/
        │   ├── dm.ts                     # Multiplayer AI DM: prompt builder, damage benchmarks, defense mitigation & parser
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
| :--- | :---: | :--- |
| `/` | ✗ | Landing page with hero section, feature grid, CTAs |
| `/login` | ✗ | Sign In / Sign Up (redirects to `/hub` if already authenticated) |
| `/auth/callback` | ✗ | Supabase OAuth / email confirmation handler |
| `/hub` | ✓ | Campaign Hub — browse campaigns, manage active tables, Quick Join |
| `/campaigns/new` | ✓ | Create new campaign with lorebook |
| `/campaigns/[id]` | ✓ | Campaign detail view |
| `/campaigns/[id]/edit` | ✓ | Edit campaign (owner only) |
| `/characters` | ✓ | Character Codex — full template-driven sheet editor workspace |
| `/table/[id]` | ✓ | Synchronized Multiplayer Table (supports UUID or 6-char table_code) |
| `/board` | ✓ | Solo 3D Tactical Battle Board _(not in active dev)_ |
