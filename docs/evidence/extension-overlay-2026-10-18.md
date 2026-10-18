# Toolbar overlay update

Removed default_popup and kept action empty. Moved scripting from optional to required permission; activeTab remains the temporary page grant. Existing service-worker floating-control now inserts scoped CSS and runs ui-overlay.js in the isolated top frame. The card uses a closed Shadow DOM, transparent fixed host, flat navy fill and negative mascot offsets. Repeat click, Escape, outside click, document removal and page unload clean up listeners and pending requests.

Existing settings/password/email functionality remains on extension-origin pages via the original fixed-route, sender-validated handler. No page-provided HTML or credential fields are introduced. Restricted pages use the existing extension-page fallback. Console connection status is not fabricated by the overlay.

Validation: full extension suite ran 133 tests with 132 passing; sole failure was the stale manifest permission expectation in status.test.mjs. After updating it, all 24 affected tests passed. Build and packaged-source parity smoke passed. Actual Chrome rendering/load acceptance is pending; no browser automation was used. Reload the unpacked extension and click its toolbar icon on an ordinary HTTP(S) page.
