# Antigravity Build Prompt — TaxTrust (working name)

Paste everything below into Antigravity as your project prompt.

---

## Project Overview

Build a landing page + core app screens for **TaxTrust**, an Indian tax-filing platform for salaried individuals and freelancers. It automatically calculates income tax (old vs new regime), applies eligible deductions, and keeps a tamper-evident record of every calculation using cryptographic hash-chaining — so users and their accountants can verify the numbers were never quietly altered.

Tech stack: React + Vite, Tailwind CSS, Framer Motion for animation, deployed as a static site first (no backend needed for the demo — mock the calculation logic client-side).

## Design Direction (match the reference image exactly)

This is a **dark, premium fintech aesthetic** — near-black background, a single bright acid-green/lime accent, and a clean geometric sans-serif typeface. Do not soften this into a generic light theme; the dark-mode-first look is the brand.

**Color tokens:**
- `--bg-primary: #0A0A0A` (near-black base)
- `--bg-panel: #141414` (subtle lighter panels, faint grid overlay pattern in hero)
- `--accent-lime: #D4F536` (primary CTA color, logo mark, highlights)
- `--text-primary: #FFFFFF`
- `--text-muted: #9B9B95` (body copy, subtext)
- `--card-cream: #E9E7DA` (the floating "card" mockup surface — a warm off-white, NOT pure white)
- `--border-subtle: rgba(255,255,255,0.08)`

**Typography:**
- Display/headline face: a rounded geometric grotesk (e.g. "General Sans", "Clash Display", or "Satoshi" — use a similar Google Font like "Sora" or "Plus Jakarta Sans" if those aren't available). Bold weight, tight letter-spacing, large scale (64–80px hero headline on desktop).
- Body/UI face: a clean neutral sans like "Inter" or "Plus Jakarta Sans" at regular weight for nav, body text, and buttons.

**Layout signature (hero section):**
- Full-width dark hero with a faint grid-line texture pattern fading from visible (top) to transparent (bottom), like the reference image.
- Floating pill-shaped navbar at the top: logo + wordmark on the left, pill-shaped nav links in the center (with the active link highlighted in a darker rounded pill), a lime "Sign up" pill button on the right.
- Large bold two-line headline on the left, sub-copy below in muted gray, two CTAs: a lime pill "Start for free" button with a circular arrow icon, and a secondary ghost link.
- On the right: a floating mockup card (cream-colored, rounded corners, soft shadow) showing a sample tax computation card instead of a bank card — e.g. "TaxTrust Verified Computation", showing something like a masked PAN, computed tax amount, and a checkmark/verified badge — held or positioned the same way the bank card is in the reference (can simplify to just the floating card without the hand if that's easier to build well).
- Below the fold: a muted "Trusted by" or "Works with" row in small monochrome logos/wordmarks (e.g. Income Tax e-Filing, AIS, Form 16 sources) — mirroring the partner-logo row in the reference, but using labels relevant to Indian tax filing infra instead of payment brands.

## Pages/Screens to Build

1. **Landing page** (primary focus — match reference style closely)
   - Navbar (Home, Features, How it Works, Pricing, Contact) + Sign up button
   - Hero section as described above
   - "How it works" 3-step section (enter details → calculate both regimes → get a tamper-evident record) — only use numbered steps here since it's a genuine sequence
   - Feature grid: Old vs New Regime Comparison, Deduction Finder, Tamper-Evident Audit Log, Freelancer/Presumptive Tax Support — each as a dark card with a lime icon accent
   - Pricing section: Free / Plus / Pro tiers as cards, lime highlight on the recommended tier
   - Footer: dark, minimal, with the lime logo mark repeated small

2. **Tax Calculator screen** (the actual product)
   - Left: a form — salary, HRA, 80C, 80D, home loan interest, other deductions
   - Right: live-updating results panel — Old Regime tax, New Regime tax, recommended option highlighted in lime, breakdown table
   - "Save & Verify" button that adds this calculation to a hash-chain log (mock this — just show a hash string being generated and appended)

3. **Audit Log / History screen**
   - A table/list of past saved calculations, each row showing date, taxable income, tax payable, and a short hash fragment
   - A "Verify Integrity" button that re-walks the chain and shows a green "✅ All records verified" state (or a red tampered-state if you want to demo the break)

## Interaction & Motion
- Subtle fade/slide-up on scroll for section reveals (keep it restrained, one clear pattern used consistently — do not over-animate)
- Hover states: nav pills darken slightly, lime buttons brighten/scale ~1.02
- The floating hero card can have a very slow, subtle ambient float/rotate animation (a few degrees, a few seconds loop) — same effect as the reference image's floating card

## Content/Copy Tone
- Plain, confident, no jargon: "Know your tax before you file it." not "Leverage AI-driven fiscal insights."
- Every button label says exactly what happens: "Calculate my tax," "Save this calculation," "Verify integrity" — not "Submit" or "Learn more."

## Build Instructions
- Start with the design token file (Tailwind config: colors, font families, border-radius scale — use large radii, 9999px for pills, ~24px for cards)
- Build the landing page hero first end-to-end (navbar + hero + floating card) and get that pixel-close to the reference before moving to other sections
- Keep everything in one cohesive component library (Button, Pill, Card, NavLink) so the calculator and audit log screens inherit the same look automatically
- Fully responsive down to mobile: navbar collapses to a hamburger, hero stacks vertically, floating card moves below the headline
- Respect `prefers-reduced-motion` — disable ambient animations for users who request it
