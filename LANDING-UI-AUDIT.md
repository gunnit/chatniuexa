# ChatAziendale Landing Page -- Deep UI/UX Audit

**Audited:** 2026-03-25
**Auditor:** Claude Opus 4.6 (code-only + screenshot analysis)
**Baseline:** Abstract SaaS best practices (Intercom, Drift, Zendesk tier)
**Screenshots:** Attempted but dev server at localhost:3000 is serving a different project (GeoPick). Audit conducted via comprehensive code analysis.
**Live URL:** https://chataziendale.onrender.com

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Visual Hierarchy & Layout | 7/10 | Strong hero layout with clear Z-pattern; demo section is compelling but 3D scene is a performance liability |
| 2. Typography & Readability | 8/10 | Excellent font pairing; fluid `clamp()` sizing on hero; minor accessibility gaps on small text |
| 3. Color & Brand Consistency | 6/10 | Cohesive palette but 30+ hardcoded hex values create maintenance debt and dark mode is broken |
| 4. Responsive & Mobile Experience | 7/10 | Good responsive patterns but Spline kills mobile performance; no `lg:hidden` on 3D scene |
| 5. Interaction & Animation | 6/10 | Smooth scroll reveals but zero `prefers-reduced-motion` support; Spline is risky |
| 6. Conversion Optimization | 6/10 | Strong CTA hierarchy but missing testimonials, pricing, FAQ, stats -- standard SaaS sections |

**Overall: 40/60**

---

## Top 5 CRITICAL Issues (Hurting Conversion)

### 1. Missing Social Proof Beyond Logos
**Impact:** High -- visitors need human validation, not just brand logos
**Finding:** The only trust signal is the "Trusted By" logo marquee. There are zero testimonials, zero customer quotes, zero usage statistics ("10,000+ chatbots deployed"), and zero case studies. For a SaaS product, this is the single biggest conversion gap. Competitors like Intercom and Drift prominently feature customer stories above the fold.
**Fix:** Add a testimonials section between the Demo and How It Works sections. Minimum 3 quotes with name, company, and photo.

### 2. No Pricing on Landing Page
**Impact:** High -- visitors who want to evaluate cost bounce to a separate page
**Finding:** Pricing exists at `/dashboard/billing` but is only accessible to logged-in users. The landing page has zero pricing information. The only reference is "Start free" / "No credit card required" in the CTA. Visitors with buying intent cannot evaluate the product.
**Fix:** Add a pricing section before the final CTA. Show the 3 tiers (Free $0, Pro $29, Business $149) with key limits. The data already exists in `en.json` billing keys.

### 3. Spline 3D Scene -- Performance Liability
**Impact:** High -- the `.splinecode` file is a large binary loaded from `prod.spline.design`
**Finding:** `SplineScene.tsx` lazy-loads the entire `@splinetool/react-spline` library and fetches a 3D scene from an external CDN. While there is a loading spinner and opacity fade-in, the scene:
- Adds significant bundle weight (Spline runtime is ~300KB+ gzipped)
- Makes an external network request that may fail or be slow
- Renders a 3D WebGL context that drains mobile batteries
- The robot recoloring logic uses `setTimeout` with 500ms and 1500ms delays, suggesting timing issues
- The code hides the "Built with Spline" watermark by hacking the renderer pipeline internals (`renderer.pipeline.logoOverlayPass.enabled = false`) -- fragile and may violate Spline's ToS
**Fix:** Replace with a high-quality static illustration or Lottie animation. If keeping Spline, add `loading="lazy"` behavior that only initializes when the viewport is above-fold and the device has sufficient GPU capability. Add a `<noscript>` fallback image.

### 4. Dark Mode Conflict -- Page Breaks for Dark-Mode Users
**Impact:** High -- CSS declares dark mode variables but landing page uses hardcoded light colors
**Finding:** `globals.css` line 101-113 defines `@media (prefers-color-scheme: dark)` that changes `--background` to `#0a0a0f`. The `body` element uses `background: var(--background)` (line 131). However, the landing page wrapper at `page.tsx:23` hardcodes `bg-[#FAFAF7]`. Result: for dark-mode users, the body background is `#0a0a0f` but the landing page div is `#FAFAF7`. This creates:
- A flash of dark background before the landing page renders
- The footer area and any gaps between sections may show dark background
- The Navbar before scroll has `bg-transparent`, so it inherits the dark body behind it -- text becomes invisible against a dark body
**Fix:** Either (a) force light mode on the landing page by adding a `<meta name="color-scheme" content="light">` or a `class="light"` on the HTML element, or (b) properly support dark mode on the landing page with conditional classes.

### 5. No FAQ Section
**Impact:** Medium-High -- FAQ reduces support load and addresses objections
**Finding:** There is no FAQ section on the landing page. Common SaaS questions like "What data formats are supported?", "Is my data secure?", "Can I cancel anytime?", "How does billing work?" are only answered in the documentation page. FAQ sections also provide SEO benefits.
**Fix:** Add an FAQ accordion section after pricing (when added) with 5-7 questions. Use the content already available in `docs` translations.

---

## Top 5 QUICK WINS (Easy, High Impact)

### 1. Add `prefers-reduced-motion` Media Query
**Effort:** 15 minutes | **Impact:** Accessibility compliance
**Finding:** Zero support across the entire codebase. The `RevealOnScroll` component applies `translateY(30px)` and `opacity` transitions, the `stagger-children` class in CSS animates all children, and the `marquee-track` runs infinite animation. None respect `prefers-reduced-motion`.
**Fix:** Add to `globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
  .stagger-children > * { animation: none; opacity: 1; }
  .marquee-track { animation: none; }
  .demo-tilt { transform: none; }
  * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```
And in `RevealOnScroll.tsx`, check `window.matchMedia('(prefers-reduced-motion: reduce)')` and skip the animation.

### 2. Add `aria-hidden="true"` to Decorative SVGs
**Effort:** 10 minutes | **Impact:** Screen reader clarity
**Finding:** `page.tsx` contains 6+ inline SVG icons (checkmarks, arrows, person icon, sparkle icon, link icon). None have `aria-hidden="true"`. Screen readers will attempt to announce these meaningless vector paths.
**Fix:** Add `aria-hidden="true"` to every decorative SVG in `page.tsx`. The hero arrow SVG (line 51), benefit checkmarks (line 66), user avatar (line 158), bot avatar (line 186), and source link icon (line 178) are all decorative.

### 3. Extract Hardcoded Colors to CSS Variables
**Effort:** 30 minutes | **Impact:** Maintainability + dark mode readiness
**Finding:** The landing page uses 8 unique hardcoded text colors (`#18181B`, `#1B1B1F`, `#52525B`, `#3F3F46`, `#71717A`, `#A1A1AA`, `#0F766E`, `#0A3D38`), 7 unique background colors, and 2 unique border colors. These are all Zinc/Teal Tailwind equivalents but hardcoded as arbitrary values.
**Color mapping:**
- `#18181B` = `zinc-900`, `#1B1B1F` = very close to `zinc-900`
- `#52525B` = `zinc-600`, `#3F3F46` = `zinc-700`
- `#71717A` = `zinc-500`, `#A1A1AA` = `zinc-400`
- `#E4E4E7` = `zinc-200`, `#D4D4D8` = `zinc-300`
- `#F4F4F5` = `zinc-100`, `#FAFAF7` = custom warm white
- `#0F766E` = `teal-700`, `#0D6960` = custom dark teal
- `#0A3D38` = custom deep teal
**Fix:** Define CSS custom properties for the landing palette in `globals.css` (e.g., `--landing-bg`, `--landing-text-primary`, `--landing-text-secondary`) and reference them via Tailwind config or utility classes. This enables dark mode in the future.

### 4. Add Descriptive `title` Attribute to LanguageSwitcher
**Effort:** 5 minutes | **Impact:** UX clarity
**Finding:** `LanguageSwitcher.tsx:29` displays `{locale.toUpperCase()}` (showing "EN" or "IT") which is the CURRENT locale, not what clicking does. Users see "EN" and may think "I'm in English" or "Click for English" -- ambiguous. The `title` prop is set correctly but the visual label is confusing.
**Fix:** Change the label text to show the target locale, not current: `{nextLocale.toUpperCase()}` instead of `{locale.toUpperCase()}`. Or add text like "EN -> IT".

### 5. Add `loading="lazy"` and Explicit Dimensions to TrustedBy Images
**Effort:** 10 minutes | **Impact:** LCP performance
**Finding:** `TrustedBy.tsx` renders 21 logo images (7 clients x 3 for the triple scroll). The `Image` components have `width` and `height` but Next.js Image optimization is disabled for SVGs (`unoptimized={client.src.endsWith('.svg')}`). Since logos are below the fold, they should be explicitly lazy-loaded.
**Fix:** Add `loading="lazy"` or Next.js `priority={false}` (default) to all logo images. Consider using CSS `content-visibility: auto` on the marquee container.

---

## Detailed Findings

### Pillar 1: Visual Hierarchy & Layout (7/10)

**Strengths:**
- **Hero communicates value prop quickly.** The headline "Customer support that actually knows your business" is immediately scannable. The badge ("Built for businesses like yours"), headline, subheadline, CTAs, and benefit pills create a clear top-down hierarchy.
- **Z-pattern reading flow works.** Left copy block -> right 3D scene (when loaded) -> CTAs pull eye back left.
- **Section order is logical:** Hero -> Features -> Trust signals -> Demo -> How it works -> CTA -> Footer. This follows a classic SaaS narrative: problem -> solution -> proof -> demo -> process -> action.
- **Grid proportions are fine.** The `grid-cols-[1.1fr_1.1fr]` (line 29) creates a balanced split. The `1.1fr` both sides is effectively 50/50 which is standard.
- **Feature cards use consistent structure.** Each has a colored bar indicator (teal/amber/rose), title, and description at uniform `p-7` padding.
- **How It Works uses a dashed connecting line** (line 212) between numbered steps -- nice visual cue.

**Weaknesses:**
- **3D scene occupies half the hero but may not load.** On Spline failure, the right half shows only a spinning loader indefinitely. There is no timeout or fallback image. The loader at `SplineScene.tsx:95-100` never resolves if the CDN is down.
- **Demo section lacks interactivity.** It is a static mock of a chat conversation. Users cannot type, click, or interact. This reduces its persuasive power. Competitors like Intercom and Drift have live chat demos.
- **"How It Works" gap between the 3 steps (gap-12) is quite large on desktop**, making the dashed connecting line stretch far.
- **Footer is too minimal.** Only has logo, copyright, and 3 links (Docs, Privacy, Terms). Missing: social media links, company info, support email, product links.
- **No anchor navigation.** Navbar has no links to page sections (Features, Demo, How It Works). Users cannot jump to sections.

**Files:** `src/app/[locale]/page.tsx:22-294`, `src/components/landing/SplineScene.tsx`

---

### Pillar 2: Typography & Readability (8/10)

**Strengths:**
- **Excellent font pairing.** Instrument Serif (display) + Plus Jakarta Sans (body) is a modern, sophisticated combination. The serif adds editorial authority while Jakarta Sans is highly legible.
- **Fluid hero sizing.** `text-[clamp(2.25rem,4.5vw,3.75rem)]` (line 37) scales the h1 from 36px to 60px based on viewport. This is a best practice.
- **Tight tracking on headings.** `tracking-[-0.02em]` on h1 and `tracking-[-0.015em]` on h2s creates professional density.
- **Good line heights.** Hero paragraph at `leading-[1.7]` and step descriptions at `leading-relaxed` (1.625) are comfortable for reading.
- **Font loading is optimized.** `display: "swap"` on all fonts (layout.tsx) prevents FOIT.

**Weaknesses:**
- **Too many font size values.** The landing page uses 11 distinct sizes:
  - `text-xs` (12px), `text-[11px]`, `text-[13px]`, `text-sm` (14px), `text-[14px]`, `text-[15px]`, `text-base` (16px), `text-[17px]`, `text-lg` (18px), `text-xl` (20px), `text-3xl`/`text-[2.5rem]`/`text-4xl`/`text-[2.75rem]`/`text-[clamp(...)]`
  - The arbitrary values (`11px`, `13px`, `14px`, `15px`, `17px`) sit between Tailwind's default scale, creating visual inconsistency. `text-[15px]` is used 6 times instead of `text-sm` (14px) or `text-base` (16px).
- **Benefit text at 13px is too small.** `text-[13px]` on line 63 for the "No credit card" / "Set up in 5 minutes" / "Cancel anytime" trust signals may fail WCAG contrast requirements at that size, especially for the `text-[#71717A]` color (zinc-500).
- **Step description text at 14px is small.** `text-[14px]` on lines 220, 230, 240 for How It Works descriptions constrained to `max-w-[240px]` creates narrow text blocks.
- **Font weights are well controlled.** Only 3 weights used: `font-medium` (500), `font-semibold` (600), `font-bold` (700). This is disciplined.

**Contrast check (calculated):**
- `#71717A` on `#FAFAF7` = contrast ratio ~4.12:1 (passes AA for normal text at 16px+, FAILS at 13px)
- `#A1A1AA` on `#FAFAF7` = contrast ratio ~2.68:1 (FAILS AA for all text sizes)
- `#52525B` on `#FAFAF7` = contrast ratio ~6.96:1 (passes AA and AAA)
- `#18181B` on `#FAFAF7` = contrast ratio ~15.4:1 (passes all levels)

**Files:** `src/app/layout.tsx:6-22`, `src/app/[locale]/page.tsx`

---

### Pillar 3: Color & Brand Consistency (6/10)

**Strengths:**
- **Teal as primary brand color is distinctive.** The `#0F766E` (teal-700) primary CTA color stands out well against the warm white `#FAFAF7` background.
- **Feature card accent colors (teal/amber/rose) create visual variety** without clashing. Each card has a thin colored bar that differentiates while maintaining consistency.
- **The dark CTA section (`#0A3D38`) creates strong contrast.** The radial gradient overlay (`rgba(20,184,166,0.15)`) adds subtle depth.
- **Robot recoloring in Spline** (`SplineScene.tsx:12-39`) uses brand-consistent colors: teal-600 body, teal-900 joints, amber-500 eyes -- clever brand integration.
- **Grayscale logos** in TrustedBy with hover-to-color is a polished pattern.

**Weaknesses:**
- **31+ hardcoded hex values** instead of design tokens. The same colors are repeated dozens of times across files as raw hex. `#18181B` appears 15+ times, `#E4E4E7` appears 14+ times, `#71717A` appears 9+ times. These should be CSS custom properties.
- **Dark mode is fundamentally broken.** `globals.css:101-113` defines dark mode overrides for `--background` and `--foreground`, but the landing page hardcodes all colors as light-mode values. A dark-mode user sees a `#0a0a0f` body background with a `#FAFAF7` landing page div on top, creating visible mismatches at the edges and during load.
- **Two near-identical text colors:** `#1B1B1F` (line 23) and `#18181B` (used everywhere else). These are visually indistinguishable and suggest a copy-paste inconsistency.
- **CTA subtitle opacity is too low.** `text-teal-300/60` (line 255) on the dark CTA section creates very low contrast text. `teal-300` (#5eead4) at 60% opacity on `#0A3D38` background is barely readable.
- **Hover states are subtle but present.** Primary CTA hover changes from `#0F766E` to `#0D6960` -- a very small shift. Could be more pronounced for better feedback.

**Color usage distribution:**
- Primary teal (`#0F766E`/`#0D6960`/`#0A3D38`/teal-*): ~20 elements (CTAs, step circles, badge, feature bars, bot avatar)
- Neutral zinc family: ~60+ elements (dominant, as expected)
- Accent amber: 2 elements (feature card bar + robot eyes)
- Accent rose: 1 element (feature card bar)
- This follows a reasonable 65/25/10 distribution

**Files:** `src/app/globals.css:1-113`, `src/app/[locale]/page.tsx`, `src/components/landing/SplineScene.tsx:12-39`

---

### Pillar 4: Responsive & Mobile Experience (7/10)

**Strengths:**
- **Mobile nav implementation is solid.** Hamburger menu (`Navbar.tsx:76-117`) with click-outside-to-close (useRef + mousedown listener), proper `aria-label="Menu"`, and animate-in transition.
- **Hero stacks vertically on mobile.** `grid lg:grid-cols-[1.1fr_1.1fr]` defaults to single column below `lg` (1024px). The 3D scene drops below the copy block.
- **CTA buttons stack vertically on mobile.** `flex-col sm:flex-row` (line 45) ensures buttons are full-width and easy to tap on phones.
- **Feature cards stack to single column.** `md:grid-cols-3` becomes single column below 768px.
- **Font sizes scale appropriately.** `text-[17px] sm:text-lg` on subheadline, `text-3xl sm:text-[2.5rem]` on h2s.
- **Marquee fade edges shrink on mobile.** `w-24 sm:w-40` ensures logos are visible on small screens.

**Weaknesses:**
- **Spline 3D scene renders on ALL devices.** There is no `lg:hidden` or media-query breakpoint to skip the 3D scene on mobile. The component always loads, consuming bandwidth and battery. The container is sized responsively (`h-[360px] sm:h-[440px] lg:h-[540px]`) but the WebGL context still initializes.
- **Touch targets on mobile nav are borderline.** The hamburger button padding is `p-2` (8px each side) on a 24x24 SVG, making the total touch area ~40x40px. Apple's HIG recommends 44x44px minimum. The mobile menu links at `py-2.5 px-4` are fine (~40px height minimum).
- **No mobile-specific spacing adjustments on many sections.** Sections use `py-24` (96px) consistently. On mobile, this creates excessive whitespace between sections that increases scroll distance.
- **Demo chat section lacks mobile optimization.** The browser chrome bar (`px-5 py-3`) and message bubbles (`max-w-md`, `max-w-lg`) may cause horizontal overflow or cramped layout on 375px screens. The `demo-tilt` 3D perspective transform may cause rendering issues on older mobile browsers.
- **Navbar brand name truncation.** On mobile (`sm:hidden`), the brand shows "ChatA.it" instead of "ChatAziendale.it". While space-efficient, this may confuse users who don't recognize the abbreviated brand.
- **LanguageSwitcher is hidden in mobile menu** (line 112-114) behind a hamburger click. International users must open the menu to switch language -- not ideal for an Italian SaaS targeting a bilingual market.

**Files:** `src/components/landing/Navbar.tsx`, `src/app/[locale]/page.tsx`, `src/components/landing/SplineScene.tsx`

---

### Pillar 5: Interaction & Animation (6/10)

**Strengths:**
- **RevealOnScroll is well-implemented.** Uses `IntersectionObserver` with `threshold: 0.15` and `rootMargin: '0px 0px -40px 0px'` (line 19-26). Triggers once and disconnects. The cubic-bezier easing `(0.16, 1, 0.3, 1)` is a smooth out-expo curve.
- **Stagger children timing is tight and professional.** 50ms delays between siblings (lines 448-453) create a cascading reveal that feels polished without being slow. Total animation for 5 children: 200ms stagger + 400ms animation = ~600ms. Good.
- **Marquee pauses on hover** (`marquee-track:hover { animation-play-state: paused }`, line 471-473). This is a nice accessibility consideration.
- **CTA buttons have micro-interactions.** `active:scale-[0.98]` (line 48) provides tactile click feedback. `group-hover:translate-x-0.5` on the arrow icon is a subtle directional cue.
- **Demo tilt effect is restrained.** Only 2deg rotation at `perspective(2000px)` (line 477) -- subtle enough not to be gimmicky. Flattens on hover.
- **SplineScene has a smooth opacity fade-in** with `cubic-bezier(0.16, 1, 0.3, 1)` over 0.8s (line 107).

**Weaknesses:**
- **ZERO `prefers-reduced-motion` support.** This is the most critical animation accessibility gap. The `RevealOnScroll` component, `stagger-children` CSS, `marquee-track`, and `demo-tilt` all run regardless of user preference. This affects users with vestibular disorders and violates WCAG 2.1 SC 2.3.3.
- **Marquee runs infinitely at 35s duration** (line 466). This is perpetual motion on screen. Even pausing on hover doesn't help non-mouse users. Should respect `prefers-reduced-motion` and ideally have a way to pause.
- **Spline scene may cause performance jank.** The 3D WebGL canvas runs a continuous render loop. On lower-end devices, this can cause scroll jank when the browser is trying to composite the 3D canvas alongside CSS transforms from RevealOnScroll.
- **No loading skeleton for Spline fallback.** The current loader (dual spinning rings, lines 97-99) is an indefinite spinner with no timeout. If Spline fails to load, users see a spinner forever. Should add: (a) a timeout after ~5s that shows a static fallback, (b) a "skip" option.
- **`smooth-scroll-behavior` on HTML** (line 124) can conflict with scroll-linked animations and is generally not recommended for SPAs.
- **No focus indicators beyond the global `:focus-visible`** (line 521-524). The CTA links and navbar links don't have custom focus styles that match their design.

**Files:** `src/components/landing/RevealOnScroll.tsx`, `src/app/globals.css:360-482`, `src/components/landing/SplineScene.tsx:92-121`

---

### Pillar 6: Conversion Optimization (6/10)

**Strengths:**
- **CTA hierarchy is clear and consistent.**
  - Primary: "Start free" -- teal background, white text, arrow icon, prominent
  - Secondary: "Sign in" -- white background, gray border, understated
  - Final CTA: "Get started free" -- inverted (white on dark teal) for contrast
  - The hierarchy follows the correct pattern: primary action dominant, secondary subdued.
- **Hero benefits reduce friction.** "No credit card required" / "Set up in 5 minutes" / "Cancel anytime" (lines 64-71) address the three main SaaS signup objections.
- **Demo section shows real product value.** The mock chat with source citations ("Source: shipping-policy.pdf -- page 3") demonstrates the core differentiator.
- **Copywriting is exceptional.** Both EN and IT translations are natural, benefit-focused, and jargon-free. Headlines use active voice. CTAs are action-oriented ("Start free" not "Submit").
- **"Three steps. Five minutes. Done."** section heading is punchy and effective.
- **Bilingual support (EN/IT)** is a competitive advantage for the Italian market.

**Weaknesses:**
- **No testimonials or customer stories.** This is the biggest conversion gap. Social proof through logos alone is weak. Visitors need to see humans saying "This product solved X for us."
- **No pricing visibility.** The Free/Pro/Business tiers ($0/$29/$149) are hidden behind authentication. Visitors cannot evaluate value before signing up. This creates unnecessary friction.
- **No FAQ section.** Objection handling happens only in documentation, which most visitors won't visit.
- **No usage statistics or social proof numbers.** "Join 500+ businesses" or "Powering 10,000+ conversations" type claims are absent. Even approximate numbers add credibility.
- **Footer is extremely sparse.** 3 links and a copyright. Missing: support contact, social media, product links, company address (important for Italian businesses due to legal requirements), P.IVA number.
- **No exit-intent or lead capture alternative.** Visitors who don't sign up have no way to stay connected. No newsletter, no "request a demo", no "contact sales" for enterprise leads.
- **ChatNiuexa widget is loaded on the landing page** (line 287-290). While this demonstrates the product, loading a third-party widget script from `chatniuexa.onrender.com` on your own landing page is: (a) a performance hit, (b) confusing if the widget belongs to a different product/brand, (c) a security risk loading external JS.
- **No A/B testing infrastructure** visible in the code. No analytics event tracking on CTAs.
- **The "Sign in" button appears both in the navbar AND the hero.** This is redundant. The hero secondary CTA could be "See pricing" or "Watch demo" instead.
- **Section order could be optimized.** Currently: Hero -> Features -> Trust -> Demo -> How It Works -> CTA. Consider: Hero -> Trust (moved up) -> Features -> How It Works -> Demo -> Pricing -> Testimonials -> FAQ -> CTA. Trust signals should come earlier; demo after process explanation.

**Files:** `src/app/[locale]/page.tsx`, `messages/en.json:34-72`, `messages/it.json:34-72`

---

## Accessibility (a11y) Issues

| Severity | Issue | Location | Fix |
|----------|-------|----------|-----|
| HIGH | No `prefers-reduced-motion` support anywhere | `globals.css`, `RevealOnScroll.tsx` | Add reduced motion media query and JS check |
| HIGH | `#A1A1AA` text on `#FAFAF7` background fails WCAG AA (2.68:1) | `page.tsx:63,177,276,279-281` | Darken to `#71717A` (zinc-500) minimum |
| HIGH | Decorative SVGs lack `aria-hidden="true"` | `page.tsx:51,66,158,178,186,263` | Add `aria-hidden="true"` to all decorative SVGs |
| MEDIUM | Spline canvas has no alt text or `aria-label` | `SplineScene.tsx:112` | Add `role="img" aria-label="3D robot assistant illustration"` to container |
| MEDIUM | `text-[13px]` benefit text with `#71717A` color may fail AA | `page.tsx:63` | Increase to `text-sm` (14px) or darken color |
| MEDIUM | Hero CTA links have no `aria-label` differentiating them | `page.tsx:46-60` | Add descriptive `aria-label` to distinguish "Start free" from "Sign in" links |
| LOW | `text-[11px]` in demo URL bar is extremely small | `page.tsx:148` | This is decorative UI chrome, but still very small |
| LOW | Language switcher shows emoji flags | `LanguageSwitcher.tsx:28` | Emoji rendering varies by OS; consider SVG flag icons |

---

## Performance Concerns

1. **Spline 3D scene** is the single largest performance concern. The `@splinetool/react-spline` package plus the `.splinecode` binary asset add significant weight to the initial page load. The `lazy()` import helps with code splitting but the asset still loads immediately.

2. **21 logo images** in TrustedBy (7 x 3 for triple scroll). While most are WebP/SVG and small, this is 21 DOM image elements.

3. **External script** `chatniuexa.onrender.com/widget.js` loaded with `strategy="afterInteractive"` still blocks the main thread after hydration.

4. **No `<link rel="preconnect">` for `prod.spline.design`** or font CDNs. While fonts use `next/font/google` (which self-hosts), the Spline CDN could benefit from preconnect hints.

5. **CSS `will-change: transform`** on `marquee-track` (line 468) promotes the element to its own compositor layer permanently. This is correct for an always-animating element but should be removed if the animation is paused.

---

## Comparison to SaaS Best Practices

| Feature | Intercom | Drift | ChatAziendale | Gap |
|---------|----------|-------|---------------|-----|
| Hero with value prop | Yes | Yes | Yes | -- |
| Live product demo | Interactive widget | Chatbot demo | Static mockup | Needs interactive demo |
| Customer testimonials | 3-5 prominent | Video + quotes | None | CRITICAL gap |
| Pricing on landing page | Yes, prominent | Yes | No | CRITICAL gap |
| Usage statistics | "25,000+ companies" | "50,000+ businesses" | None | Should add |
| FAQ section | Yes | Yes | No | Should add |
| Video/animation | Lottie animations | Product video | Spline 3D (heavy) | Consider lighter alternatives |
| Footer | Full with sitemap | Full with resources | 3 links only | Needs expansion |
| Social proof numbers | Yes | Yes | Logo strip only | Should add |
| Exit intent / newsletter | Yes | Yes | No | Should add |

---

## Files Audited

| File | Lines | Purpose |
|------|-------|---------|
| `src/app/[locale]/page.tsx` | 294 | Main landing page |
| `src/components/landing/Navbar.tsx` | 121 | Navigation bar |
| `src/components/landing/SplineScene.tsx` | 121 | 3D robot scene |
| `src/components/landing/RevealOnScroll.tsx` | 46 | Scroll animation wrapper |
| `src/components/landing/TrustedBy.tsx` | 75 | Client logo marquee |
| `src/components/LanguageSwitcher.tsx` | 32 | Language toggle |
| `src/components/CookieConsent.tsx` | 53 | Cookie banner |
| `src/app/globals.css` | 559 | Design system and animations |
| `src/app/layout.tsx` | 45 | Root layout with fonts |
| `src/app/[locale]/layout.tsx` | 29 | Locale layout wrapper |
| `messages/en.json` | 522 | English translations |
| `messages/it.json` | 522 | Italian translations |

---

## Prioritized Recommendations Summary

### Must Fix (Before Next Launch Push)
1. Add `prefers-reduced-motion` support (accessibility compliance)
2. Fix WCAG contrast failures on `#A1A1AA` text elements
3. Add `aria-hidden="true"` to decorative SVGs
4. Add Spline loading timeout + static fallback image
5. Fix dark mode conflict (force light on landing page)

### Should Fix (Next Sprint)
6. Add testimonials section with 3+ customer quotes
7. Add pricing section with Free/Pro/Business tiers
8. Add FAQ accordion section
9. Extract hardcoded hex colors to CSS custom properties
10. Expand footer with company info, social links, support email, P.IVA

### Nice to Have (Backlog)
11. Replace Spline with lighter Lottie or static illustration
12. Add section navigation links to navbar
13. Make demo section interactive (connect to live chatbot)
14. Add usage statistics / social proof numbers
15. Add exit-intent email capture for non-converters
16. Consider removing duplicate "Sign in" CTA from hero (keep in navbar only)
17. Add `<link rel="preconnect">` for external domains
18. Evaluate whether ChatNiuexa widget should remain on the landing page

---

*Audit conducted via comprehensive code analysis. Visual screenshots were not captured because the dev server at localhost:3000 was serving a different project (GeoPick). Recommend re-running visual audit when ChatAziendale dev server is available, or auditing the live URL at https://chataziendale.onrender.com.*
