# Third-party components

Sentinel integrates existing engines, models and libraries. Their inclusion is not a claim that Sentinel's contributors authored or trained them. Each component retains its own license and attribution requirements.

| Component | Use | Notice location |
|---|---|---|
| ClamAV / Cisco Talos | Native signature engine and databases | Engine distribution's COPYING/license files; GPL terms and corresponding-source obligations apply |
| YARA-X | Rule compilation and matching in the Rust inspection core | Upstream distribution and Rust dependency metadata |
| llama.cpp | Local CPU model inference | Packaged `artifacts/local-ai/licenses/llama.cpp-MIT.txt` |
| SmolLM2 | Lightweight local explanation model | Packaged `artifacts/local-ai/licenses/SmolLM2-Apache-2.0.txt` |
| Qwen2.5 1.5B Instruct | Local chat model | Upstream model license and the Apache 2.0 notice distributed with model assets |
| Node.js | Local orchestration runtime | Packaged `tools/runtime/NODE-LICENSE.txt` |
| Microsoft WebView2 | Embedded browser rendering | Microsoft runtime/SDK license and distribution terms |
| React, Vite, TypeScript, Tailwind CSS | Interface and frontend tooling | Dependency lockfile and each upstream license |
| SQLite / rusqlite | Embedded threat/quarantine records | Upstream notices and Rust dependency metadata |
| uAssets badware list | Browser risk-list snapshot | `apps/extension/third-party/uassets-LICENSE.txt` and source snapshot attribution |
| Fonts and interface icons | Presentation assets | Font package licenses and `apps/ui/src/components/lucide-icons.LICENSE` |

Release packaging must preserve the notices in each bundled distribution. This index is not a replacement for full license texts. The ClamAV engine source is available from [Cisco Talos/ClamAV](https://github.com/Cisco-Talos/clamav); match source to the exact binary version shipped.
