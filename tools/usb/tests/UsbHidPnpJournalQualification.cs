using System;
using System.IO;
using System.Security.Principal;

// Explicit elevated qualification of file persistence, never a device action.
internal static class UsbHidPnpJournalQualification {
 public static int Main() {
  try {
   if (!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator))
    throw new InvalidOperationException("Elevation required");
   string nonce = Guid.NewGuid().ToString("N");
   string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "SentinelHidPnpJournalQualification");
   SentinelPolicyDirectory.Provision(root);
   string leaf = Path.Combine(root, nonce);
   if (Directory.Exists(leaf)) throw new InvalidOperationException("Fixture collision");
   SentinelPolicyDirectory.Provision(leaf);
   Console.WriteLine("PRIVATE protected persistence qualification; no USB operation");
   return UsbHidPnpFileJournalTest.Main(new[] { "--protected-private", nonce });
  } catch (Exception error) {
   Console.WriteLine(error.ToString());
   return 1;
  }
 }
}
