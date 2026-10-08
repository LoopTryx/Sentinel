# Launcher Windows PowerShell compatibility candidate

Friend-laptop startup exposed a PowerShell7 requirement. Actual Windows PowerShell5.1 launch reproduced MethodNotFound at SHA256.HashData before UI startup. Replace the instance-identity hash with disposable SHA256.Create/ComputeHash and BitConverter hex; identity algorithm and mutex namespace are unchanged.

Regression tools/tests/launcher-compat.ps1 checks the actual launcher calculation against an independently computed SHA256 golden value for a synthetic path. Passed on actual Windows PowerShell5.1 and bundled PowerShell7. This verifies identity compatibility, not visible desktop/WebView startup. Repository verifier passed before adding the required identity check; the added check also passes independently. Recorded full verifier in .local-handoff/launcher-compat-verify.log.

Next: controlled launch/visible window verification under5.1, document package launch policy and requirements, then peer review and issue15 PR. Existing v1.0.0 ZIP is unchanged and still documents PowerShell7. Do not claim friend installation fixed or republish tag silently.
