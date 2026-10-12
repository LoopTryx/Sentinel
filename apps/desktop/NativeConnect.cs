using System;
using System.IO;
using System.Text;
using System.Diagnostics;
using System.Threading;
using System.Collections.Generic;
using System.Net.Http;
using System.Web.Script.Serialization;
using System.Text.RegularExpressions;

public static class SentinelNativeConnect {
    static readonly JavaScriptSerializer Json=new JavaScriptSerializer { MaxJsonLength=4096 };
    static string Here { get { return AppDomain.CurrentDomain.BaseDirectory; } }
    static byte[] ReadExact(Stream input,int count) { var bytes=new byte[count];int offset=0;while(offset<count){int read=input.Read(bytes,offset,count-offset);if(read==0)throw new EndOfStreamException();offset+=read;}return bytes; }
    public static int Main(string[] args) {
        object reply;
        try {
            if(args.Length<1 || !Regex.IsMatch(args[0],"^chrome-extension://[a-p]{32}/$"))throw new InvalidOperationException();
            var registration=Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(Here,"native-host.json")));
            var origins=(System.Collections.IList)registration["allowed_origins"];
            if(origins.Count!=1 || (string)origins[0]!=args[0])throw new InvalidOperationException();
            var input=Console.OpenStandardInput();int length=BitConverter.ToInt32(ReadExact(input,4),0);
            if(length<1 || length>1024)throw new InvalidOperationException();
            var request=Json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(ReadExact(input,length)));
            if(request.Count!=1 || !request.ContainsKey("operation") || (string)request["operation"]!="connect")throw new InvalidOperationException();
            string id=args[0].Substring(19,32);
            reply=Pair(id);
        } catch { reply=new {error="connection_unavailable"}; }
        byte[] response=Encoding.UTF8.GetBytes(Json.Serialize(reply));
        var output=Console.OpenStandardOutput();output.Write(BitConverter.GetBytes(response.Length),0,4);output.Write(response,0,response.Length);output.Flush();return 0;
    }
    static object Pair(string id) {
        try { return RequestPair(id); } catch { }
        Process.Start(new ProcessStartInfo(Path.Combine(Here,"Sentinel.Glass.exe"),"--app --tray") { UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=Here });
        for(int attempt=0;attempt<100;attempt++) { Thread.Sleep(100);try{return RequestPair(id);}catch{} }
        throw new InvalidOperationException();
    }
    static object RequestPair(string id) {
        string path=Path.Combine(Here,"demo-runtime.json");
        if(new FileInfo(path).Length>4096)throw new InvalidOperationException();
        var config=Json.Deserialize<Dictionary<string,string>>(File.ReadAllText(path));Uri uri;
        if(!Uri.TryCreate(config["url"],UriKind.Absolute,out uri)||uri.Scheme!="http"||uri.Host!="127.0.0.1"||uri.Port<1024||uri.Port>65535||uri.AbsolutePath!="/"||uri.Query.Length!=0||uri.UserInfo.Length!=0||!Regex.IsMatch(config["token"],"^[a-f0-9]{64}$"))throw new InvalidOperationException();
        using(var client=new HttpClient(new HttpClientHandler { AllowAutoRedirect=false,UseProxy=false })) {
            client.Timeout=TimeSpan.FromSeconds(2);
            client.MaxResponseContentBufferSize=4096;
            client.DefaultRequestHeaders.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",config["token"]);
            using(var response=client.PostAsync(config["url"]+"/pair",new StringContent(Json.Serialize(new {extensionId=id}),Encoding.UTF8,"application/json")).GetAwaiter().GetResult()) {
                response.EnsureSuccessStatusCode();string raw=response.Content.ReadAsStringAsync().GetAwaiter().GetResult();if(raw.Length>4096)throw new InvalidOperationException();
                var pair=Json.Deserialize<Dictionary<string,object>>(raw);
                if(pair.Count!=3||(string)pair["extensionId"]!=id||!Regex.IsMatch((string)pair["token"],"^[a-f0-9]{64}$")||Convert.ToInt32(pair["port"])!=uri.Port)throw new InvalidOperationException();
                return pair;
            }
        }
    }
}
