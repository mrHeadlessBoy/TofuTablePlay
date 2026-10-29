# TofuTablePlay — Website UI & Design System

> **Design Philosophy: Modern Minimalist Dark / Smooth Fade & Layered Opacity**
> 
> TofuTablePlay adopts a distraction-free, "Swiss Dark / Linear-aesthetic" design language. The system deliberately rejects saturated neon glows, bloom, and glare in favor of **layered opacity surfaces (`backdrop-blur-md`, subtle alpha channels)**, **smooth fade transitions**, **matte amber accents**, and **high-contrast typography**.

---

## 1. Design Tokens & Color Palette

### 1.1 Surfaces & Opacity Hierarchy
Surfaces are built from translucent zinc layers over a deep neutral canvas:

| Surface Level | Tailwind Class / CSS | Purpose |
| :--- | :--- | :--- |
| **Canvas / Base** | `bg-zinc-950` (`#09090b`) | Primary application background, neutral black |
| **Surface 1 (Cards & Panels)** | `bg-zinc-900/40 backdrop-blur-md border border-zinc-800/50` | Standard cards, sidebars, narrative feed, modals |
| **Surface 2 (Hover / Active)** | `hover:bg-zinc-800/30 hover:border-zinc-700/60` | Card elevation, interactive container highlights |
| **Recessed Insets** | `bg-black/30 border border-zinc-800/70` | Text inputs, code blocks, draft action areas |
| **Floating Overlays** | `bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/80 shadow-2xl` | Dialogs, template studio modal, alert popups |

### 1.2 Accents (Matte & Muted)
- **Primary CTA**: `bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 text-zinc-100 font-medium rounded-lg`
- **Secondary CTA**: `bg-zinc-900/60 hover:bg-zinc-800/70 border border-zinc-800/60 text-zinc-300 font-medium rounded-lg`
- **Ghost Action**: `text-zinc-400 hover:text-zinc-200 transition-colors duration-200`
- **Subtle Badges**: `bg-amber-500/10 border border-amber-500/20 text-amber-400/90 rounded-full px-2.5 py-0.5 text-xs`

### 1.3 Typography
- **Font Sans**: Geist Sans (`var(--font-geist-sans)`)
- **Font Mono**: Geist Mono (`var(--font-geist-mono)`)
- **Primary Headings**: `text-zinc-100 font-semibold tracking-tight`
- **Body Text**: `text-zinc-300 text-sm leading-relaxed`
- **Secondary Labels**: `text-zinc-400 text-xs`
- **Metadata / Timestamps**: `text-zinc-500 text-xs font-mono`

### 1.4 Brand Identity & Visual Assets
- **Official Brand Logo (`public/assets/pictures/logo_tofutableplay.png`)**:
  - Horizontal lockup with character emblem + stylized typography on transparent alpha background (trimmed of excessive whitespace for true-to-scale rendering).
  - Rendered with Next.js `<Image>` component:
    - **Hero Centerpiece (`src/app/page.tsx`)**: `h-20 sm:h-28 md:h-32 w-auto` (prominently centered atop the main headline)
    - **Top Navigation (`src/app/page.tsx`)**: `h-8 sm:h-9 w-auto` (compact clickable home link)
    - **Hub Header (`HubHeader.tsx`)**: `h-10 sm:h-12 w-auto`
    - **Login Card (`src/app/login/page.tsx`)**: `h-14 sm:h-16 w-auto`
  - Replaces all legacy generic shield icons (`lucide-shield`) sitewide.
- **Asset Directory Structure**:
  - `public/assets/pictures/logo_tofutableplay.png`: Active primary brand logo.
  - `public/assets/pictures/unused/`: Archived concept graphics, exploratory logos, and original untrimmed source images.
- **Active Table Geometric Indicator**:
  - Replaces traditional blinking online/offline status dots with a minimalist rotating amber triangle (`animate-[spin_6s_linear_infinite]`), matching the tabletop polyhedral aesthetic.

---

## 2. Micro-Interactions & Motion

- **Smooth Fade Opacity**:
  Transitions rely on gentle alpha shifts rather than sudden flashes:
  `transition-opacity duration-200 ease-out`
- **Subtle Elevation**:
  Cards gently rise on hover without blur glow:
  `transition-all duration-200 ease-out hover:-translate-y-0.5`
- **Text Selection**:
  Dark matte selection highlighting:
  `selection:bg-zinc-800 selection:text-amber-200`
- **Minimalist Scrollbars**:
  Ultra-thin 5px rounded scrollbars that fade in on hover (`rgba(63, 63, 70, 0.45)`).

---

## 3. Global CSS Utilities (`globals.css`)

```css
/* Translucent frosted container */
.surface-panel {
  background-color: rgba(24, 24, 27, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(39, 39, 42, 0.5);
}

/* Smooth hover transition */
.surface-panel-hover {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.surface-panel-hover:hover {
  background-color: rgba(39, 39, 42, 0.35);
  border-color: rgba(63, 63, 70, 0.6);
  transform: translateY(-1px);
}

/* Masked gradient for smooth scroll fade-out at edges */
.fade-mask-y {
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 16px, black calc(100% - 16px), transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, black 16px, black calc(100% - 16px), transparent 100%);
}
```

---

## 4. Implemented Screens & Components

### 4.1 Landing Page (`src/app/page.tsx`)
- **Brand Logo Navigation**: Frosted glass sticky header with compact official brand logo (`logo_tofutableplay.png`), language toggle (`LanguageToggle`), and clean Sign In link (distraction-free without duplicate enter hub buttons).
- **Hero Centerpiece Logo**: Grand, high-resolution official brand logo (`h-20 sm:h-28 md:h-32`) placed directly above the main headline, delivering an atmospheric tabletop RPG portal welcome.
- **Hero & Typography**: Focused headline and storytelling subtitle without colored glow blobs or cluttered pill tags, utilizing clean leading and tracking.
- **Streamlined Direct Flow**: Connects the Hero call-to-action buttons directly into the 3-pillar feature grid, eliminating extraneous preview mockups for maximum focus, speed, and elegance.
- **Pillar Feature Grid**: 3-column card grid explaining Synchronized Action Drafting, Dynamic Lorebooks, and Host Authority using `.surface-panel .surface-panel-hover`.
- **Bilingual Support**: Dynamic Thai/English switching seamlessly applied to all landing page copy.
- **Minimalist Footer**: Clean single-line copyright statement without redundant navigation hotlinks.

### 4.2 Login & Authentication Screen (`src/app/login/page.tsx`)
- **Floating Glass Container**: Layered `.surface-panel` card with deep shadow (`shadow-2xl`) and backdrop blur.
- **Branded Header**: Displays official brand logo (`logo.png`) with return link (`/`) and `LanguageToggle`.
- **Recessed Dark Inputs**: Low-contrast, distraction-free text inputs with subtle focus states (`focus:border-zinc-600 focus:bg-black/60`).
- **Tactile Matte Button**: Amber action button with micro-lift on hover and built-in loading spinner (`Loader2`).
- **Localized Feedback**: Bilingual authentication error messaging and switchable login/register modes.

### 4.3 Hub & Campaign Management (`src/features/hub/...`, `src/features/campaign/...`)
- **Hub Header (`HubHeader.tsx`)**: Frosted navigation bar with brand logo (`logo.png`), character codex shortcut, and campaign authoring trigger with smooth hover micro-lifts.
- **Quick Join Bar (`QuickJoinBar.tsx`)**: Low-profile frosted container with monospace uppercase table code input and tactile join button.
- **Active Table Cards**: Real-time table cards with rotating geometric amber triangle accents, monospace code pills, and copyable invite link chips.
- **Public Campaign Cards**: Streamlined card deck with category badges, author chips, 2-line story preview (`line-clamp-2`), removed sheet format tags, and smooth slide navigation with indicator dots.
- **Campaign Studio (`CampaignForm.tsx` & `CampaignDetailsClient.tsx`)**: Refined layered opacity sections, recessed form inputs, structured rule builder tiles, and lorebook keyword tags without harsh glare.

### 4.4 Character Codex & Template Studio (`src/features/character/...`)
- **Codex Header (`CharacterCodexHeader.tsx`)**: Minimalist top navigation bar with return link and `LanguageToggle`.
- **Character Roster Sidebar**: Frosted list items using `.surface-panel .surface-panel-hover` with smooth delete icon transitions and concise status badges.
- **Sheet Editor Container (`CharacterEditor.tsx`)**: Translucent `.surface-panel rounded-2xl` workspace with recessed inputs (`bg-black/40 border-zinc-800/80`), tactile stat dials, and modular skill/inventory cards.
- **Template Studio Modal (`TemplateModal.tsx`)**: Frosted modal dialog (`bg-zinc-950/95 backdrop-blur-xl`) with smooth fade-in overlay, recessed sub-panels, and matte amber action buttons.

### 4.5 Virtual Tabletop (VTT) & In-Table HUD (`src/features/table/...`, `src/components/dice/...`)
- **Top-Left Navigation Pill**: Low-profile floating capsule (`bg-zinc-950/80 backdrop-blur-xl border-zinc-800/70`) with instant table code copy and `LanguageToggle`.
- **Narrative Chronicle (`NarrativeFeedPanel.tsx`)**: Turn cards upgraded to `.surface-panel .surface-panel-hover rounded-2xl p-6` with subtle dividers and high-legibility typography. Overview and decision blocks styled with matte translucent backgrounds, eliminating glowing bloom shadows.
- **Private Drafting Input Bar**: Recessed dark input field (`bg-black/40 border-zinc-800/80`), frosted dice launcher button, and tactile ready toggle with micro-elevation.
- **SAO Character Orb & Inspector (`SaoCharacterOrb.tsx`, `CharacterInspectorPanel.tsx`)**: Dual semicircle status dials with deep ambient drop shadows (no neon amber glow/blur). Drawer window styled as modern `rounded-2xl` frosted container with a refined matte header line.
- **Party Roster Sidebar (`PartyRosterSidebar.tsx`)**: Frosted floating HUD (`bg-zinc-950/80 backdrop-blur-xl`) with sleek member cards and lorebook overview.
- **Party Chat & 3D Dice Tray (`PartyChatWidget.tsx`, `DiceRoller.tsx`)**: Floating translucent chat bubble and dice roller modal with smooth fade backdrop and tactile matte controls.

---

## 5. Implementation Status by Phase

- [x] **Phase 1: Global Theme & Base Tokens** — *Completed*
- [x] **Phase 2: Landing Page & Authentication** — *Completed*
- [x] **Phase 3: Hub & Campaign Management** — *Completed*
- [x] **Phase 4: Character Codex & Template Studio** — *Completed*
- [x] **Phase 5: Virtual Tabletop (VTT) & In-Table HUD** — *Completed*
- [x] **Phase 6: Verification & QA** — *Completed*

---

## 6. การแก้ไขที่ต้องการ (Completed Edits)

### 1. หน้าแรก (`src/app/page.tsx`)
- [x] **ใช้อันนี้เป็น logo แทน lucide-shield `dnd-playground\public\assets\pictures\logo_tofutableplay.png`**: ติดตั้ง `<Image src="/assets/pictures/logo_tofutableplay.png">` แสดงผลโลโก้แบรนด์อย่างคมชัดบน Navbar และขยายขนาดให้โดดเด่นเหมาะสมทุกหน้า (`h-10 sm:h-12` บน Navbar/Hub, `h-14 sm:h-16` บน Login)
- [x] **AI-Orchestrated Tabletop Engine ลบตรงนี้ออก**: ลบ Pill Tag ในส่วน Hero ออกเรียบร้อยแล้ว
- [x] **ไม่ว่าที่ไหนที่มีการใช้ lucide-shield เอาออกให้หมด ไม่ว่าจะเป็นหน้าแรก หน้า login หรือหน้าอื่น ๆ**: ปลด Shield ออกจากทั้งระบบ (`page.tsx`, `login/page.tsx`, `HubHeader.tsx`, `TemplateModal.tsx`, `CharacterInspectorPanel.tsx`, `NarrativeFeedPanel.tsx`, `BoardPanels.tsx`) ทั้งหมด 100%
- [x] **ตัดส่วน {/* DM Chronicle Passage */} และกล่อง Preview ออก**: ลบกล่อง Live Story Preview Mockup ออกทั้งหมดตามที่ผู้ใช้ปรับแต่ง เพื่อให้หน้าแรกเรียบง่าย กระชับ และมุ่งเน้นการเริ่มต้นเล่นทันที
- [x] **ตัดปุ่ม enter hub ที่ navbar ออกเพราะไม่จำเป็น**: ลบปุ่ม เข้าสู่ฮับ (Enter Hub) จาก Navbar หน้าแรกแล้ว
- [x] **ตัด hotlink Campaign Hub และ Player Account ออก**: ลบลิงก์สองตัวนี้ออกจาก Footer หน้าแรก คงเหลือข้อความลิขสิทธิ์คลีนๆ ตัวเดียว

### 2. หน้า Hub (`src/features/hub/components/...`)
- [x] **ที่ Public Worlds & Campaigns การ์ดของข้อมูลให้แสดงตัวอย่างของ campaign แค่ 2 บรรทัดพอ ปัจจุบันแสดง 4**: ปรับเป็น `line-clamp-2` เรียบร้อย
- [x] **ที่ Public Worlds & Campaigns การ์ดของข้อมูลให้ตัด sheet format ออก ไม่จำเป็นต้องแสดง**: ตัดแถบแท็ก `sheetFormat` ออกจากการ์ดแคมเปญสาธารณะเรียบร้อย
- [x] **ไม่ว่าที่ไหนที่มีการใช้ lucide-shield เอาออกให้หมด**: ตรวจสอบและปลดออกครบถ้วนทุกจุดใน Hub และ Header
- [x] **เอา `<span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block animate-pulse" />` ออกใน section ของ active tables เพราะไม่จำเป็นต้องแสดงสถานะของ table ว่า online หรือ offline ลองดีไซน์มาใหม่ เช่น 3 เหลี่ยมหมุน สีเขียวหรือ amber**: แทนที่ด้วย 3 เหลี่ยม Amber หมุนนุ่มนวล (`animate-[spin_6s_linear_infinite]`) ทั้งในหัวข้อ Active Tables และบนการ์ดโต๊ะเล่น

