using System;using System.Collections.Generic;
internal static class RuntimeReadiness {
 internal static bool Accept(Dictionary<string,object> snapshot){
  object mode,connected;
  return snapshot!=null&&snapshot.TryGetValue("mode",out mode)&&mode is string&&Array.IndexOf(new[]{"synthetic_demo","encrypted_vault"},(string)mode)>=0&&snapshot.TryGetValue("connected",out connected)&&connected is bool&&(bool)connected;
 }
}
