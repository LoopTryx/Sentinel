"""Compile actual command logic with a unit-only Tauri facade and harmless Windows I/O.
Never invoke simulation, drive inventory or OS policy. This is not native IPC acceptance.
"""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument("--baseline", help="Hex commit to compare legacy scan_path only")
parser.add_argument("--work-dir", help="Owned sentinel-native-command-harness-* directory under TEMP")
args = parser.parse_args()
root = Path(__file__).resolve().parents[3]
if os.name != "nt":
    raise SystemExit("Windows harmless sharing tests required")
if args.baseline and not re.fullmatch(r"[0-9a-f]{7,40}", args.baseline):
    raise SystemExit("Baseline must be a hex commit")
base = Path(tempfile.gettempdir()).resolve()
work = Path(args.work_dir).resolve() if args.work_dir else Path(tempfile.mkdtemp(prefix="sentinel-native-command-harness-"))
if base not in work.parents or not work.name.startswith("sentinel-native-command-harness-"):
    raise SystemExit("Work directory must be an owned harness directory under TEMP")
(work / "src").mkdir(parents=True, exist_ok=True)
commands = root / "apps/desktop-tauri/src/commands.rs"
if args.baseline:
    text = subprocess.run(["git", "show", args.baseline + ":apps/desktop-tauri/src/commands.rs"], cwd=root, check=True, capture_output=True).stdout.decode("utf-8")
    # Do not copy or compile legacy simulation containing a real test signature.
    text = text.split("#[tauri::command]\npub fn simulate_attack", 1)[0]
    if "real_eicar" in text:
        raise SystemExit("Legacy staging code must be excluded")
else:
    text = commands.read_text(encoding="utf-8")
text = text.replace("#[tauri::command]\n", "").replace("use tauri::{AppHandle, Emitter, State};", "use crate::tauri::{AppHandle, Emitter, State};")
(work / "src/commands.rs").write_text(text, encoding="utf-8")
shutil.copyfile(root / "apps/desktop-tauri/src/scan_policy.rs", work / "src/scan_policy.rs")
shutil.copyfile(Path(__file__).with_name("commands_harness.rs.in"), work / "src/lib.rs")
shutil.copyfile(root / "Cargo.lock", work / "Cargo.lock")
manifest = '[package]\nname="sentinel-native-command-harness"\nversion="0.1.0"\nedition="2021"\n[workspace]\n[dependencies]\n'
manifest += 'sentinel-av={path="' + (root / "crates/sentinel-av").as_posix() + '"}\n'
manifest += 'serde={version="1",features=["derive"]}\nserde_json="1"\nchrono={version="0.4",features=["serde"]}\nuuid={version="1",features=["v4"]}\n'
(work / "Cargo.toml").write_text(manifest, encoding="utf-8")
cargo = Path.home() / ".cargo/bin/cargo.exe"
print("Unit-only command facade; real bounded benign engine/database I/O. Native IPC remains unverified.", flush=True)
result = subprocess.run([str(cargo), "test", "--manifest-path", str(work / "Cargo.toml"), "--offline", "--target-dir", str(root / "target")], cwd=root)
raise SystemExit(result.returncode)
