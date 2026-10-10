using System;

// Private native metadata. No renderer-supplied filename or approval is accepted.
public sealed class NativeSelectionBinding
{
    string scanId, path;
    public void Clear() { scanId = null; path = null; }
    public void Accept(string acceptedScanId, string selectedPath, bool singleFile)
    {
        Clear();
        if (!singleFile || String.IsNullOrEmpty(selectedPath) || acceptedScanId == null ||
            !System.Text.RegularExpressions.Regex.IsMatch(acceptedScanId, "^[a-f0-9]{24}$")) return;
        scanId = acceptedScanId; path = selectedPath;
    }
    public string Resolve(string currentScanId, string reportRef, int reportCount)
    {
        if (scanId == null || currentScanId != scanId || reportRef != "report_0" || reportCount != 1)
            throw new InvalidOperationException("native_subject_binding_unavailable");
        return path;
    }
}
