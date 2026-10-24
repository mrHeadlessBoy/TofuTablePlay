# 🐉 D&D Playground — Synchronized AI Tabletop RPG

An intelligent, real-time tabletop roleplaying platform combining **synchronized multiplayer text campaigns**, a **solo 3D tactical grid battle board**, **3D polyhedral dice rolling**, **dynamic multilingual lorebooks**, and an automated **AI Dungeon Master** powered by Google Gemini.

---

## 🌟 Key Features

### 1. 📜 Campaign Studio & Dynamic Lorebook (`/campaigns`)
* **World & Rule Authoring:** Create, view, and edit campaigns with custom genres, world settings, overarching story briefs, and specialized tabletop mechanics (`/campaigns/new`, `/campaigns/[id]`, `/campaigns/[id]/edit`).
* **Smart Lorebook Engine:** Automatically injects relevant world lore into AI DM prompts without bloating context tokens:
  * `Always Active`: Injected into every turn and opening scene.
  * `Keyword Triggered`: Scanned against recent turn history and player action drafts (automatically falls back to matching the entry's **Title** if no explicit keywords are set).
  * `Secret / DM-Only`: Hidden from regular players in the table sidebar and reserved exclusively for AI DM context (always active for the DM when keywords are left blank, or triggered on match when keywords are specified).
* **Multilingual & Symbol-Safe Matching:** Supports English, Thai (without requiring space boundaries), and special symbols (e.g., `+1 sword`, `C++`, `(blessing)`) with safe regex escaping.

### 2. 🧙‍♂️ Character Codex & Live Inspector (`/characters`)
* **Reusable Character Sheets:** Build, edit, and delete persistent characters with class archetypes, race, appearance, backstory, strengths, and weaknesses.
* **Combat & Resource Tracking:**
  * **HP & Skill Cost Pools:** Track `Current HP / Max HP` alongside **`Current Skill Cost / Max Skill Cost`** for casting or activating abilities.
  * **Ability Scores:** Full 6-stat support (`STR`, `DEX`, `CON`, `INT`, `WIS`, `CHA`) supporting negative, zero, and positive values with automatic D&D 5e modifier calculation.
  * **6 Equipment Slots & Inventory:** Dedicated gear slots (`Head`, `Torso`, `Leg`, `Foot`, `Left Hand`, `Right Hand`) plus freeform backpack inventory.
  * **Custom Character Skills:** Add unlimited skills per character (`Skill Name`, `Skill Cost`, `Description`), automatically formatted into the AI DM's Party Reference Sheet.
* **Live In-Session Editing & Hot-Swapping:** Update HP, Skill Cost, status conditions (e.g., *Normal, Bloodied, Stunned, Poisoned*), stats, equipment, inventory, and skills—or switch to another character sheet—without leaving the table.

### 3. 🤝 Synchronized Multiplayer Tabletop (`/table/[id]`)
* **AI Opening Scene Generation:** Launching a table as **Head Table** prompts the AI DM to write a custom Turn 0 opening narration (`คำบรรยาย`) grounded in the campaign setting and active lorebook.
* **Private Turn Drafting ("Gartic Phone" Loop):** Players secretly draft actions and roll dice simultaneously without seeing teammates' choices beforehand, preventing meta-gaming.
* **Server-Synced Ready Barrier:** When every party member clicks **Ready**, a server-clock-calibrated 5-second countdown begins (`getServerTime` offset sync). If anyone un-readies, the countdown cancels immediately.
* **Hybrid Realtime Architecture:** Powered by Supabase PostgreSQL Changes + low-latency Broadcast channels (`member_ready`, `table_sync`, `party_chat`) + optimistic ready claims and polling fallback.
* **Table Codes & Direct Invite Links:** Join active sessions from the Hub using a 6-character Table Code (e.g., `7K4X9B`) or a one-click copyable Invite Link (`/table/<code>`).
* **Floating Party Chat Widget:** Real-time in-table chat supporting **In-Character (`IC`)** roleplay dialogue and **Out-of-Character (`OOC`)** coordination, unread counters, host badges, and Web Audio API ping notifications.

### 4. 🗺️ 3D Tactical Battle Board (`/board`) (NOT IN DEVELOPMENT)
* **Procedural Three.js Grid Maps:** Interactive 3D tabletop prototype featuring seeded maps across 3 themes (`Forest`, `Ruins`, `Dungeon`) with elevation, water/bridges, props, `MapControls` camera pan/zoom, and `5 ft`-per-tile movement reachability.
* **Party & Threat Sandbox:** Deploy multiple Codex heroes onto the grid, place custom Enemy or NPC tokens, inspect stats, adjust HP, and trigger quick ability checks.
* **Retro Visual-Novel Dialogue & Story Log:** Grapheme-accurate Thai/English typewriter `DialogueBox` (`Intl.Segmenter`) with page navigation alongside a filterable turn-by-turn `StoryLog` (`All`, `Story`, `Actions`, `Dice`).
* **Structured JSON AI DM:** Evaluates token coordinates, distances to nearest opponents, and dice rolls to return structured JSON (`narration`, `scene`, `rolls`, `hpChanges`, `spawns`, `defeated`) that automatically updates board tokens and persists session progress in `localStorage`.

### 5. 🎲 3D Polyhedral Dice Roller (`src/components/dice/`)
* **Interactive 3D Dice Tray:** Three.js-rendered polyhedral dice (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`) with tumbling animation and critical hit / critical fail visual highlights.
* **Full Tabletop Modifiers:** Supports multi-dice pools, flat modifiers, character ability score bonuses, `Normal` / `Advantage` / `Disadvantage` modes, and optional `DC` target checks.
* **Seamless Action Integration:** Automatically appends formatted roll results into the player's action draft in Multiplayer Table mode or logs pending roll outcomes for the DM in Battle Board mode.

### 6. 🔊 Event & Dice Notification Audio (`src/lib/sound.ts`)
* **Contextual Sound Effects:** Autoplay-safe audio notifications (`public/assets/sound/`) triggered across gameplay events:
  * **Dice Roll Tiers:** `< 10` (`roll_under_10.wav`), `10–14` (`roll_more_than_10_under_15.wav`), and `>= 15` (`roll_more_than_15.wav`).
  * **System Events:** Player entering table (`player_enter_table.wav`), new AI DM turn narration (`Ai_reply.wav`), and error alerts (`error.wav`).

### 7. 🤖 AI Dungeon Master Engine (`src/lib/ai/dm.ts`)
* **Balanced Combat & Enemy HP% Scaling:** Enforces anti-one-shot damage scaling, tracks enemy health percentages in `[ Overview ]`, and outputs conditional `[ Decision ]` DC prompts only when meaningful obstacles or risks are present.
* **Bounded Sliding-Window History & Anti-Repetition:** Maintains recent turn context for token efficiency while preventing repeated phrasing or overriding unsubmitted player agency.
* **Host Narrative Override & Atomic Locking:** Head Table hosts can edit any turn's narrative output in place, while atomic database phase transitions prevent duplicate AI executions.

### 8. 🛡️ Authentication, Security & Room Governance
* **Supabase Auth & 6-Hour Session Guard:** Email/password authentication with middleware-enforced 6-hour session expiration (`dnd_session_start` cookie) and post-login route restoration (`?next=...`).
* **Room & Campaign Governance:** Head Table member kick controls, player `Leave Table` support, custom confirmation/status modals (`AlertModal`), and cascading cleanup when deleting tables or campaigns.

---

## 🛠️ Tech Stack

* **Framework:** [Next.js 16.4](https://nextjs.org/) (App Router, Turbopack, Server Actions)
* **Frontend:** [React 19.3](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/), [Tailwind CSS 4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
* **3D Graphics:** [Three.js](https://threejs.org/) (`three` `^0.186.1`)
* **Database, Auth & Realtime:** [Supabase](https://supabase.com/) (`@supabase/ssr`, `@supabase/supabase-js`, PostgreSQL Realtime & Broadcast)
* **AI Engine:** [Google Gemini](https://ai.google.dev/) (`@google/genai` — `gemini-3.5-flash-lite`)
* **Package Manager / Runtime:** [Bun](https://bun.sh/) (or Node.js `v20+` with `npm`)

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
* `campaigns` — Campaign metadata, world setting, core story, rule mechanics, and creator ownership
* `lorebook_entries` — Campaign lore entries (`title`, `category`, `activation_mode`, `trigger_keys`, `content`)
* `characters` — Player character sheets (`stats` JSONB including ability scores, skill cost, and custom skills, plus `equipment`, `inventory`, `current_hp`, `max_hp`, `armor_class`, `status_condition`)
* `tables` — Active multiplayer sessions (`table_code`, `campaign_id`, `head_table_id`, `current_turn`, `turn_phase`, `countdown_end`)
* `table_members` — Connected party members, linked `character_id`, `is_ready` flag, and secret `action_text` draft
* `turns` — Turn-by-turn AI DM `narrative_output`, `party_actions_summary`, and `edited_by_host` flag

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

## 📁 Project Architecture

```text
├── middleware.ts                         # Auth route protection & 6-hour session timeout guard
├── public/
│   └── assets/sound/                     # WAV sound notifications (dice roll tiers, enter, AI reply, error)
└── src/
    ├── app/
    │   ├── layout.tsx                    # Root layout with fonts & global AlertProvider
    │   ├── page.tsx                      # Landing page
    │   ├── auth/callback/route.ts        # Supabase OAuth / email confirmation callback handler
    │   ├── login/page.tsx                # Sign In / Sign Up screen
    │   ├── hub/                          # Campaign Hub
    │   │   ├── page.tsx                  # Server loader for public campaigns & user's active tables
    │   │   ├── HubClient.tsx             # Quick Join (Code/Invite Link), Active Tables & Campaign carousel
    │   │   └── actions.ts                # Launch table (with AI opening scene), join, leave, delete, sign out
    │   ├── campaigns/                    # Campaign Studio
    │   │   ├── CampaignForm.tsx          # Shared campaign & dynamic lorebook authoring form
    │   │   ├── actions.ts                # Create & update campaigns and lorebook entries
    │   │   ├── new/page.tsx              # Create new campaign route
    │   │   └── [id]/                     # Campaign details ([id]/page.tsx) & owner edit ([id]/edit/page.tsx)
    │   ├── characters/                   # Character Codex
    │   │   ├── page.tsx                  # Character list & sheet workspace
    │   │   ├── CharacterEditor.tsx       # Sheet form (HP, Skill Cost, 6 Stats, 6 Equipment Slots, Skills)
    │   │   ├── equipment.ts              # Shared stat/skill/equipment sanitizers & clamping helpers
    │   │   └── actions.ts                # Create, update & delete character sheets
    │   ├── table/[id]/                   # Synchronized Multiplayer Tabletop
    │   │   ├── page.tsx                  # Session loader (supports UUID or table_code URLs & DM lore filtering)
    │   │   ├── TablePlayground.tsx       # Realtime sync coordinator, clock offset & turn lifecycle
    │   │   ├── NarrativeFeedPanel.tsx    # Turn chronicle, Host override editor, action input & DiceRoller
    │   │   ├── CharacterInspectorPanel.tsx # Live in-game combat sheet editor, Skill slots & sheet switcher
    │   │   ├── PartyRosterSidebar.tsx    # Connected party status, HP/Skill Cost bars, kick & campaign lore tabs
    │   │   ├── PartyChatWidget.tsx       # Floating IC/OOC realtime party chat with audio ping
    │   │   ├── countdown.ts              # Synchronized ready countdown constants
    │   │   ├── types.ts                  # Tabletop TypeScript definitions & optimistic ready claims
    │   │   └── actions.ts                # Ready barrier, atomic AI turn resolution, combat sheet updates
    │   └── board/                        # Solo 3D Tactical Battle Board
    │       ├── page.tsx                  # Server loader for player characters & public campaigns
    │       ├── BoardLoader.tsx           # Client-only dynamic loader for Three.js board
    │       ├── BoardPlayground.tsx       # Turn flow, grid movement, token placement & dice integration
    │       ├── BoardScene.tsx            # Three.js 3D procedural map, props, lighting & token renderer
    │       ├── BoardPanels.tsx           # HUD cards (Scene, Party Roster, Threat List, Token Inspector, Rolls)
    │       ├── DialogueBox.tsx           # Grapheme-safe retro typewriter narration box
    │       ├── StoryLog.tsx              # Filterable turn-by-turn chronicle drawer
    │       └── actions.ts                # Server Action bridging board turns & lorebooks to Gemini
    ├── components/
    │   ├── dice/                         # Reusable 3D Polyhedral Dice System
    │   │   ├── DiceRoller.tsx            # Dice tray UI (d4–d100, modifiers, actor stats, Adv/Disadv, DC)
    │   │   ├── Die3D.tsx                 # Three.js 3D polyhedral mesh & roll animation
    │   │   ├── dice.ts                   # Pure dice math, ability modifiers & roll formatters
    │   │   └── index.ts                  # Barrel exports
    │   └── ui/
    │       └── AlertModal.tsx            # Global modal & confirmation dialog context (useAlert)
    └── lib/
        ├── sound.ts                      # Autoplay-resilient dice & system sound notification player
        ├── turns.ts                      # Opening narration turn index constant (OPENING_TURN_NUMBER)
        ├── ai/
        │   ├── dm.ts                     # Multiplayer AI DM prompt builder, opening scene & combat scaling
        │   ├── boardDm.ts                # Battle Board JSON AI DM prompt builder & safe reply parser
        │   └── lorebook.ts               # Multilingual keyword/title scanner & DM-only lore filter
        ├── board/
        │   ├── maps.ts                   # Seeded procedural map generator & BFS tile reachability
        │   ├── session.ts                # Board session state & localStorage persistence
        │   ├── turn.ts                   # Board DM input builder & state mutation applier
        │   ├── types.ts                  # Grid, terrain, token & DM JSON types
        │   └── utils.ts                  # Board helper utilities
        └── supabase/
            ├── client.ts                 # Browser Supabase client
            └── server.ts                 # SSR cookie client & Service Role admin client
```
