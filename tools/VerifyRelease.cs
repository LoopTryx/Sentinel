using System;using System.IO;using System.IO.Compression;using System.Reflection;using System.Collections.Generic;using System.Security.Cryptography;using System.Web.Script.Serialization;
public static class VerifyRelease {
 static string Hash(Stream s){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(s)).Replace("-","").ToLowerInvariant();}
 public static int Check(string setup,string mapping){var json=new JavaScriptSerializer{MaxJsonLength=4194304};var changes=json.Deserialize<Dictionary<string,string>>(File.ReadAllText(mapping));
  using(var input=Assembly.LoadFile(Path.GetFullPath(setup)).GetManifestResourceStream("Sentinel.Payload.zip"))using(var zip=new ZipArchive(input,ZipArchiveMode.Read)){
   List<Dictionary<string,string>> rows;using(var reader=new StreamReader(zip.GetEntry("manifest-sha256.json").Open()))rows=json.Deserialize<List<Dictionary<string,string>>>(reader.ReadToEnd());
   if(zip.Entries.Count!=rows.Count+1)throw new IOException("Payload file count mismatch");var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
   foreach(var row in rows){string name=row["path"];if(!names.Add(name))throw new IOException("Duplicate path");var entry=zip.GetEntry(name);if(entry==null)throw new IOException("Missing payload file");using(var s=entry.Open())if(Hash(s)!=row["sha256"])throw new IOException("Payload hash mismatch: "+name);
    string source;if(changes.TryGetValue(name,out source))using(var s=File.OpenRead(source))if(Hash(s)!=row["sha256"])throw new IOException("Stale package source: "+name);
   }
   using(var reader=new StreamReader(zip.GetEntry("apps/extension/dist/manifest.json").Open()))if(!reader.ReadToEnd().Contains("1.0.0"))throw new IOException("Wrong extension version");return rows.Count;
  }
 }
}
