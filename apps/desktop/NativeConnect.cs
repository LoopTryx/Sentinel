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
    static readonly JavaScriptSerializer Json=new JavaScriptSerializer { MaxJsonLength=131072 };
    static string Here { get { return AppDomain.CurrentDomain.BaseDirectory; } }
    static byte[] ReadExact(Stream input,int count) { var bytes=new byte[count];int offset=0;while(offset<count){int read=input.Read(bytes,offset,count-offset);if(read==0)throw new EndOfStreamException();offset+=read;}return bytes; }
    [STAThread] public static int Main(string[] args) {
        object reply;
        try {
            if(args.Length<1 || !Regex.IsMatch(args[0],"^chrome-extension://[a-p]{32}/$"))throw new InvalidOperationException();
            var registration=Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(Here,"native-host.json")));
            var origins=(System.Collections.IList)registration["allowed_origins"];
            if(origins.Count!=1 || (string)origins[0]!=args[0])throw new InvalidOperationException();
            var input=Console.OpenStandardInput();int length=BitConverter.ToInt32(ReadExact(input,4),0);
            if(length<1 || length>8192)throw new InvalidOperationException();
            var request=Json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(ReadExact(input,length)));
            string id=args[0].Substring(19,32);
            if(request.Count==1&&request.ContainsKey("operation")&&(string)request["operation"]=="connect")reply=Pair(id);
            else if(request.Count==1&&request.ContainsKey("operation")&&(string)request["operation"]=="overview")reply=BrowserOverview.Read();
            else if(request.Count==1&&request.ContainsKey("operation")&&(string)request["operation"]=="open-ai"){using(var signal=EventWaitHandle.OpenExisting("Local\\SentinelDesktopOpen"))signal.Set();reply=new{ok=true};}
            else if(request.Count==3&&request.ContainsKey("operation")&&(string)request["operation"]=="vault"&&request.ContainsKey("action")&&request.ContainsKey("data")){var data=request["data"] as Dictionary<string,object>;if(data==null)throw new InvalidOperationException();reply=WindowsVault.BrowserRequest(request["action"] as string,data);}
            else if(request.Count==2&&request.ContainsKey("operation")&&request.ContainsKey("id")&&((string)request["operation"]=="copy"||(string)request["operation"]=="rotate"))reply=WindowsVault.BrowserRequest((string)request["operation"],new Dictionary<string,object>{{"id",request["id"]}});
            else throw new InvalidOperationException();
        } catch(Exception failure) { reply=new {error=failure is IOException?failure.Message:"connection_unavailable"}; }
        byte[] response=Encoding.UTF8.GetBytes(Json.Serialize(reply));
        var output=Console.OpenStandardOutput();output.Write(BitConverter.GetBytes(response.Length),0,4);output.Write(response,0,response.Length);output.Flush();return 0;
    }
    static object Pair(string id) {
        var clock=Stopwatch.StartNew();bool started=false;
        var directories=new[]{Here,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Sentinel","Desktop","apps","desktop","console-build")};
        while(clock.ElapsedMilliseconds<7500){
            foreach(string directory in directories){int remaining=7500-(int)clock.ElapsedMilliseconds;if(remaining<150)break;try{return RequestPair(id,directory,Math.Min(1500,remaining));}catch{}}
            if(!started){started=true;Process.Start(new ProcessStartInfo(Path.Combine(Here,"Sentinel.Glass.exe"),"--app --tray") { UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=Here });}
            Thread.Sleep(100);
        }
        throw new InvalidOperationException();
    }
    static object RequestPair(string id,string directory,int timeoutMilliseconds) {
        string path=Path.Combine(directory,"demo-runtime.json");
        if(new FileInfo(path).Length>4096)throw new InvalidOperationException();
        var config=Json.Deserialize<Dictionary<string,string>>(File.ReadAllText(path));Uri uri;
        if(!Uri.TryCreate(config["url"],UriKind.Absolute,out uri)||uri.Scheme!="http"||uri.Host!="127.0.0.1"||uri.Port<1024||uri.Port>65535||uri.AbsolutePath!="/"||uri.Query.Length!=0||uri.UserInfo.Length!=0||!Regex.IsMatch(config["token"],"^[a-f0-9]{64}$"))throw new InvalidOperationException();
        using(var client=new HttpClient(new HttpClientHandler { AllowAutoRedirect=false,UseProxy=false })) {
            client.Timeout=TimeSpan.FromMilliseconds(timeoutMilliseconds);
            client.MaxResponseContentBufferSize=4096;
            client.DefaultRequestHeaders.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",config["token"]);
            using(var response=client.PostAsync(new Uri(uri,"/pair").AbsoluteUri,new StringContent(Json.Serialize(new {extensionId=id}),Encoding.UTF8,"application/json")).GetAwaiter().GetResult()) {
                response.EnsureSuccessStatusCode();string raw=response.Content.ReadAsStringAsync().GetAwaiter().GetResult();if(raw.Length>4096)throw new InvalidOperationException();
                var pair=Json.Deserialize<Dictionary<string,object>>(raw);
                if(pair.Count!=3||(string)pair["extensionId"]!=id||!Regex.IsMatch((string)pair["token"],"^[a-f0-9]{64}$")||Convert.ToInt32(pair["port"])!=uri.Port)throw new InvalidOperationException();
                return pair;
            }
        }
    }
}
