using System;
using System.IO;

// A short read lease prevents the retired exact engine from preparing a decision
// during a new-engine policy operation. Never retain it while awaiting a worker.
// The separately authenticated baseline/GPO lease still guards actual policy.
internal static class UsbHidRetiredExactGuard {
 internal static void Run(Action operation) {
  if (operation == null) throw new ArgumentNullException("operation");
  string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "SentinelUsbExact");
  FileAttributes attributes;
  try { attributes = File.GetAttributes(root); }
  catch (DirectoryNotFoundException) { operation(); return; }
  catch (FileNotFoundException) { operation(); return; }
  if ((attributes & FileAttributes.Directory) == 0 || (attributes & FileAttributes.ReparsePoint) != 0)
   throw new InvalidOperationException("Previous USB runtime path is not a trusted directory");
  string state = Path.Combine(root, "State");
  if (!Directory.Exists(state)) throw new InvalidOperationException("Existing exact USB runtime requires recovery");
  using (var store = new UsbExactBlockFileStore(state)) {
   store.WithReadFence((committed, pending, fence) => {
    if (pending != null || (committed != null && committed.Blocked.Length != 0))
     throw new InvalidOperationException("Release and recover the previous USB engine before switching");
    fence();
    operation();
    fence();
   });
  }
 }
}
