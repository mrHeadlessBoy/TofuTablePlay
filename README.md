# 🐉 D&D Playground — Synchronized AI Tabletop RPG

An intelligent, real-time tabletop roleplaying platform combining collaborative player turn drafting, dynamic lorebook triggers, and an automated AI Dungeon Master powered by Gemini.

---

## 🌟 Key Features

### 1. 📜 Campaign Studio & Dynamic Lorebook
* **World & System Authoring:** Create campaigns with custom genres, world settings, overarching story briefs, and specialized game mechanics.
* **Smart Lorebook Triggers:** Contextual lore entries automatically injected into AI prompts when triggered by keywords in player actions.
* **Multilingual & Symbol Support:** Supports English, Thai, and special characters (e.g. `C++`, `+1 sword`, `(blessing)`) with safe regex handling.
* **Activation Modes:**
  * `Always Active`: Injected into every turn.
  * `Keyword Triggered`: Scanned against recent turn history and player action drafts.
  * `Secret / DM-Only`: Reserved exclusively for DM narrative decisions.

### 2. 🧙‍♂️ Character Codex & Live Inspector
* **Reusable Sheets:** Save and manage character archetypes, ability scores (STR, DEX, CON, INT, WIS, CHA), HP, Armor Class, visual appearance, backstory, and inventory.
* **In-Game Combat Sheet Editing:** Directly adjust Current HP, Max HP, AC, Conditions (e.g., *Normal, Bloodied, Stunned, Poisoned*), ability scores, and inventory right inside the session.
* **Switch Sheet:** Seamlessly switch between characters in your codex without leaving the session.

### 3. 🎲 Synchronized Tabletop Session
* **Private Turn Drafting:** Players write their secret action drafts simultaneously without seeing other players' choices beforehand.
* **Synchronized Ready Barrier:** When all players click **Ready**, a 5-second synchronized countdown triggers. If any player un-readies, the countdown cancels.
* **Live Party Roster:** Displays connected party members with their linked character sheet, class archetype, live HP meters, status conditions, and readiness indicators.
* **Realtime Sync:** Powered by Supabase PostgreSQL Changes + Broadcast channels + auto-sync fallback.

### 4. 🤖 AI Dungeon Master
* **Contextual Narrative Generation:** Weaves party actions, recent turn events, and triggered lore into a cohesive narrative with tactical summaries and dice-roll requirements.
* **Bounded Rolling History:** Limits previous turn history to a sliding window of recent turns to maintain token efficiency and prevent prompt explosion.
* **Host Narrative Override:** Head Table (host) can edit AI narrative blocks to steer story direction.
* **Atomic Concurrency Protection:** Race-condition guards prevent duplicate AI narrative resolution when countdown finishes across multiple client browsers.

### 5. 🛡️ Room & Campaign Governance
* **Head Table Host Management:** Host controls table resolution and member kicking.
* **Participant Leave Option:** Players can leave joined tables anytime to clean up their Active Tables list.
* **Cascade Cleanup:** Safe deletion of campaigns and tables including all child members, turns, actions, and lorebook entries.

---

## 🛠️ Tech Stack

* **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
* **Frontend:** [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
* **Database & Auth:** [Supabase](https://supabase.com/) (`@supabase/ssr`, `@supabase/supabase-js`, PostgreSQL Realtime)
* **AI Engine:** Google Gemini (`@google/genai`)
* **Package Manager / Runtime:** [Bun](https://bun.sh/)

---

## 🚀 Getting Started

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v20+) or [Bun](https://bun.sh/) (v1.2+)
* A [Supabase](https://supabase.com/) project with Database and Authentication enabled.
* A [Google Gemini API Key](https://aistudio.google.com/).

### 2. Environment Variables
Create a `.env` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-gemini-api-key
```

### 3. Installation & Run
```bash
# Install dependencies
bun install

# Run the development server
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Architecture

```
src/
├── app/
│   ├── layout.tsx                # App root layout with theme & metadata
│   ├── page.tsx                  # Landing page
│   ├── login/                    # Authentication (Sign In & Sign Up)
│   ├── hub/                      # Campaign Hub (Active Tables & Explore Campaigns)
│   │   ├── HubClient.tsx         # Client UI with Join by Code & Table management
│   │   └── actions.ts            # Server Actions (launch, join, leave, delete)
│   ├── campaigns/new/            # Campaign Studio & Lorebook creator
│   │   └── actions.ts            # Server Actions (create campaign & lorebook)
│   ├── characters/               # Character Codex
│   │   ├── CharacterEditor.tsx   # Character sheet manager form
│   │   └── actions.ts            # Character persistence actions
│   └── table/[id]/               # Realtime Tabletop Session
│       ├── TablePlayground.tsx   # Synchronized play area & live inspector
│       └── actions.ts            # Turn resolution, drafting, ready status
└── lib/
    ├── ai/
    │   ├── dm.ts                 # AI DM prompt construction & narrative generation
    │   └── lorebook.ts           # Multilingual lore scanner & keyword matcher
    └── supabase/
        ├── client.ts             # Browser Supabase client
        └── server.ts             # SSR and Admin Supabase clients
```
