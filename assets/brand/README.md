# Sentinel shield

The owner supplied the Sentinel shield/S artwork for v3. The wordmark and white background were removed with image editing; `sentinel-shield.png` is the transparent source asset.

Run `powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-brand-assets.ps1` from the repository root to regenerate Windows ICO, extension PNG sizes and UI assets. The native console embeds its icon, so the tray does not depend on a loose file after installation.
