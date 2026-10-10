# SENTINEL demo corpus

Every file here is **inert** — plain text or random bytes with zero
executable capability. Together they exercise every detection layer of
the engine so the demo can show a full catch on stage, end to end:
scan → detect → quarantine (AES vault) → telemetry.

Drop this folder on the demo USB stick, point SENTINEL at it, and each
file lights up a different layer:

| File | Detection layer | Expected verdict |
|---|---|---|
| `eicar.com` | Industry-standard antivirus test signature (hash DB + YARA + string check, 3 layers at once) | malicious |
| `fake-trojan.txt` | Dropper stand-in marker (YARA) | malicious |
| `fake-ransom.txt` | Ransomware demo marker (YARA) | malicious |
| `downloader.ps1` | Hidden encoded PowerShell, runtime-decoded base64 blob, raw-IP payload fetch (YARA, 3 rules) | suspicious |
| `suspicious.vbs` | Scripted shell exec + raw-IP download (YARA, 2 rules) | suspicious |
| `autorun.inf` | USB auto-execution config (YARA + filename heuristic) | suspicious |
| `invoice.pdf.exe` | Double-extension filename trick (filename heuristic) | suspicious |
| `packed-demo.exe` | High-entropy packed payload (entropy heuristic) | suspicious |
| `README.md` | nothing — stays clean | clean |

Notes for demo day:
- Windows Defender may delete `eicar.com` the moment it touches disk.
  If it is missing, re-create it from the standard EICAR string (search
  "EICAR test file" on the AV-Test site) or add a Defender exclusion for
  the USB stick — see PROGRESS.md "CRITICAL demo-day knowledge".
- The other files are invisible to Defender (they contain no real
  malware), so the corpus survives copying between machines.
