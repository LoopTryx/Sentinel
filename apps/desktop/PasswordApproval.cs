using System.Security.Principal;
using System.Text.RegularExpressions;
public static class PasswordApproval {
 public static int Main(string[] args) {
  if(args.Length!=2||(args[0]!="copy"&&args[0]!="rotate"&&args[0]!="view"&&args[0]!="add"&&args[0]!="remove"&&args[0]!="update")||!Regex.IsMatch(args[1],"^[a-zA-Z0-9_-]{1,64}$"))return 1;
  return new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator)?0:1;
 }
}
