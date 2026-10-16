# ASCII background and Console/sidebar simplification — 16 October 2026

Owner supplied GradientASCII React/WebGL2 source, with colors[#9f1239,#f43f5e,#fda4af,#fff1f2], shape rise, characters ' =+xX0S8#@',cellSize22,density.8. Integrated that renderer as the app backdrop, replacing the Dither instance; former Dither source retained to preserve history. Requested rose palette is decorative and does not establish threat state. Existing real scan evidence/theme/Reset console semantics remain unchanged.

Adaptations: max24fps draws, default/capped DPR1, max~1.5million render pixels and4096px dimension, bounded palettes/characters/color cache/speed. Pause on document hidden, offscreen, context loss; dynamically honor reduced motion. Canvas context failure falls back to local radial gradient. Explicit program/texture/framebuffer/VAO cleanup retains canvas context for React StrictMode reuse instead of calling loseContext on normal unmount. Shader failure frees partial programs. Font callbacks ignore disposed instances. App disables pointer/click reactions; no new external assets/dependencies. Actual shader appearance/GPU utilization remains unmeasured; limits are not a performance guarantee on MX250.

Console removes Shield Modules and USB capability summary; USB Guard navigation/page remains. Dashboard quick actions and real reset button remain tested. Sidebar keeps wheel/keyboard scroll but hides scrollbar; collapsed aside uses intrinsic height capped by viewport so it ends after the last icon. Expanded selection uses azure gradient and collapsed SVG icons get220ms hover/focus lift/scale with active feedback and reduced-motion override.

shadcn skill read and pnpm dlx shadcn@latest info --json/docs button consulted. Context Vite/Tailwind4, config:null, no installed shadcn components. Existing semantic buttons retained; hover is a CSS extension, no shadcn installation or migration claim. Earlier browser URL-policy denial respected; installed visual/HiDPI/keyboard acceptance remains manual. Engineer A review before integration, no release/merge.

Files: apps/ui/src/App.tsx; views/Dashboard.tsx; components/ui/GradientASCII.tsx; components/liquid-sidebar.css; dashboard-actions.test.tsx; gradient-ascii-lifecycle.test.tsx. Focused3files/4tests PASS, including StrictMode cleanup, draw cap, pixel cap, visibility/offscreen/reduced-motion/context-loss/fallback and remaining dashboard navigation.

Final verification: tools/verify.ps1 PASS (21 UI files/45tests, TypeScript/native checks, production UI build and extension smoke). Focused StrictMode renderer rerun2tests PASS. git diff --check PASS. Built UI includes final renderer cleanup. No installed hardware/visual acceptance claimed.

Owner preset amendment: blue horizon, colors[#1e3fd8,#f6f8ff,#a5d8ff,#38bdf8],cell18,density.8,characters unchanged. New attached source matches previous supplied renderer; performance/lifecycle adaptations retained. Static no-WebGL fallback also blue. This supersedes the earlier rose/rise preset only; runtime threat states are still driven by scan evidence.

Blue preset verification: full tools/verify.ps1 PASS,45 UI tests/native/typecheck/build/extension smoke; diff check PASS. No new implementation-mirroring tests added for the preset-only change. Installed visual acceptance remains pending.
