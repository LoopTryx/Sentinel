# Security policy

Sentinel is actively developed security software. Do not treat its warnings or clean scan results as a guarantee of safety, and keep the operating system's existing protection enabled.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository if available. Otherwise contact the repository owner privately before publishing exploit details. Do not put passwords, API keys, message contents or personal device identifiers into a public issue.

Include the affected version, a minimal harmless reproduction, expected and observed behavior, and the security boundary involved. Use invented accounts and files. Do not send live malware or trigger device-policy changes on another person's computer.

## Supported release

Security fixes target the current 1.x release. Archived 0.x previews are retained for history and are not recommended for real credentials or daily-use protection.

## Boundaries and limitations

- The app normally runs in user mode. Native Windows API calls are not proof of kernel isolation.
- Windows Hello authorizes sensitive app actions; DPAPI protects stored secrets for the Windows user. This does not establish protection from every process already running as that user or from an administrator/kernel compromise.
- Loopback requests require authentication and validation; localhost alone is not an authorization boundary.
- AI output is advisory. Untrusted email text must not authorize privileged actions.
- File scanning does not establish USB firmware or HID safety. Experimental device-policy enforcement remains separately gated.
- Hash manifests detect deviation from a trusted expected digest; they are not a substitute for publisher code signing or a trusted update channel.
