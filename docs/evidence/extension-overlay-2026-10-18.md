# Toolbar overlay update

Removed default_popup and kept action empty. Moved scripting from optional to required permission; activeTab remains the temporary page grant. Existing service-worker floating-control now inserts scoped CSS and runs ui-overlay.js in the isolated top frame. The card uses a closed Shadow DOM, transparent fixed host, flat navy fill and negative mascot offsets. Repeat click, Escape, outside click, document removal and page unload clean up listeners and pending requests.

Existing settings/password/email functionality remains on extension-origin pages via the original fixed-route, sender-validated handler. No page-provided HTML or credential fields are introduced. Restricted pages use the existing extension-page fallback. Console connection status is not fabricated by the overlay.

Validation: full extension suite ran 133 tests with 132 passing; sole failure was the stale manifest permission expectation in status.test.mjs. After updating it, all 24 affected tests passed. Build and packaged-source parity smoke passed. Actual Chrome rendering/load acceptance is pending; no browser automation was used. Reload the unpacked extension and click its toolbar icon on an ordinary HTTP(S) page.

## Navigation repair

Supersedes the earlier navigation-only card: removed the toolbar fallback and floating_open route handler entirely. Injection failures show a toolbar badge without tab creation. The wrapper is appended directly to document.body with a transparent fixed background. Existing functional controls are embedded in an extension-origin frame inside the card; Settings/Passwords switch within that frame, and its dashboard-launch button is disabled/hidden. The host URL is unchanged. Mascots stay outside the card, above the host webpage. Native approval gates are preserved; content-script callers gain no vault API. An origin- and source-checked close message handles Escape inside the embedded controls. The web-accessible popup frame is a changed embedding boundary requiring independent review before release.

Targeted overlay/navigation/account tests and build parity passed. Real Chrome page CSP/embedding acceptance remains pending; no installed-browser result is claimed.
