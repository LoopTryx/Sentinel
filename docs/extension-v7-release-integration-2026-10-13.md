# Engineer B v6/v7 release integration — 13 October 2026

Downloaded private draft release assets from their release IDs through authenticated GitHub API; draft tag lookup404 was resolved by listing releases. Both ZIP digests matched metadata and extraction paths/count/size were checked before extraction.

v6 SHA256 d78371ec149548ebfa6211a49c4eb6b8829adf14844303d445b3779a5e6c4414; v7 SHA2565b2662034fa7b599952672cc50f46481b07abafe28035187808af48bb0442f8d. Release v7 source identifies045eb4cb8fb83bbb92d5c10afb2d27aa02a81b6d and pending PR70. v6 warning HTML/style/script/mascot were already integrated. v6-to-v7 asset differences are only warning.html and src/warning-page.css: static mascot shadow and looping wink, disabled under prefers-reduced-motion. Imported those exact files. Manifest build version0.2.3.

Retained newer desktop-connected popup and transport/worker changes because stock v6/v7 popup would revert owner-requested password controls and native auto-connection. No permission expansion or security-decision changes.69 extension tests passed; build and source/dist packaging smoke passed. Installed/unpacked file hashes match. Chrome is not exposed to current browser controls, so its Reload/visual warning acceptance remains unexecuted. Reload Sentinel once at chrome://extensions to activate the copied assets.

Frozen v2.0.0 release remains unchanged; this increment is on the owned branch for subsequent packaging. NativeConsole.cs remains preserved and untracked.
