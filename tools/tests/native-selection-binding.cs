using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;
class BindingTests
{
    static void Refuses(NativeSelectionBinding binding, string id, string report, int count)
    {
        try { binding.Resolve(id, report, count); }
        catch (InvalidOperationException) { return; }
        throw new Exception("Unexpected action authority");
    }
    static void Main()
    {
        const string a = "aaaaaaaaaaaaaaaaaaaaaaaa", b = "bbbbbbbbbbbbbbbbbbbbbbbb";
        var binding = new NativeSelectionBinding();
        Refuses(binding, a, "report_0", 1);
        binding.Accept(a, "C:\\owned-test\\A.txt", true);
        if (binding.Resolve(a, "report_0", 1) != "C:\\owned-test\\A.txt") throw new Exception();
        Refuses(binding, b, "report_0", 1);
        Refuses(binding, a, "report_1", 1);
        Refuses(binding, a, "report_0", 2);
        binding.Clear(); // Replacement rejected by runtime: old label cannot authorize.
        Refuses(binding, a, "report_0", 1);
        binding.Accept(b, "C:\\owned-test\\folder", false);
        Refuses(binding, b, "report_0", 1);
        binding.Accept("invalid", "C:\\owned-test\\B.txt", true);
        Refuses(binding, "invalid", "report_0", 1);
        var snapshot = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>("{\"reports\":[{}]}");
        if (!(snapshot["reports"] is System.Collections.ICollection)) throw new Exception("Unexpected report array");
        Console.WriteLine("Native selection binding regressions passed.");
    }
}
