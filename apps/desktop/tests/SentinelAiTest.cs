using System;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
class SentinelAiTest {
 sealed class Handler:HttpMessageHandler {
  public HttpStatusCode Code=HttpStatusCode.OK;public string Body="{\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"content\":\"{\\\"evidenceRefs\\\":[],\\\"explanation\\\":\\\"Check the official website.\\\",\\\"uncertainty\\\":\\\"No finding attached.\\\",\\\"recommendations\\\":[\\\"Verify independently.\\\"]}\"}}]}";
  public string Seen;public bool Called,Wait,Offline;
  protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage r,CancellationToken c){Called=true;if(Offline)throw new HttpRequestException("secret must never escape");if(Wait)await Task.Delay(10000,c);Seen=await r.Content.ReadAsStringAsync();if(r.RequestUri.AbsoluteUri!=SentinelNim.Endpoint||r.Headers.Authorization.Scheme!="Bearer")throw new Exception("transport binding");return new HttpResponseMessage(Code){Content=new StringContent(Body)};}
 }
 static void Check(bool b){if(!b)throw new Exception("assertion failed");}
 static void Refuses(Action a,string expected){try{a();throw new Exception("accepted");}catch(SentinelAiException e){Check(e.Code==expected);}}
 static int Main(){
  var nativeProvider=new SentinelNim();Check(System.Net.ServicePointManager.SecurityProtocol==System.Net.SecurityProtocolType.Tls12);
  Check(SentinelNim.Payload(SentinelNim.DefaultModel,new{question="Hi",finding=(object)null}).Contains("\"enable_thinking\":false"));
  Check(!SentinelNim.Payload("custom/model",new{question="Hi"}).Contains("chat_template_kwargs"));
  var h=new Handler();var p=new SentinelNim(new HttpClient(h));var j=new JavaScriptSerializer();
  Refuses(()=>p.Generate("key","meta/llama-3.1-8b-instruct","{}",false,new string[0],CancellationToken.None).GetAwaiter().GetResult(),"consent_required");Check(!h.Called);
  var result=p.Generate("key","meta/llama-3.1-8b-instruct","{}",true,new string[0],CancellationToken.None).GetAwaiter().GetResult();Check(result!=null&&!h.Seen.Contains("key"));
  h.Code=HttpStatusCode.Unauthorized;Refuses(()=>p.Generate("key","meta/llama-3.1-8b-instruct","{}",true,new string[0],CancellationToken.None).GetAwaiter().GetResult(),"invalid_credentials");
  h.Code=(HttpStatusCode)429;Refuses(()=>p.Generate("key","meta/llama-3.1-8b-instruct","{}",true,new string[0],CancellationToken.None).GetAwaiter().GetResult(),"rate_or_quota_limit");
  h.Code=(HttpStatusCode)503;Refuses(()=>p.Generate("key","meta/llama-3.1-8b-instruct","{}",true,new string[0],CancellationToken.None).GetAwaiter().GetResult(),"provider_unavailable");
  h.Code=(HttpStatusCode)422;Refuses(()=>p.Generate("key","meta/llama-3.1-8b-instruct","{}",true,new string[0],CancellationToken.None).GetAwaiter().GetResult(),"unsupported_model_or_request");
  h.Code=(HttpStatusCode)202;Refuses(()=>p.Generate("key","meta/llama-3.1-8b-instruct","{}",true,new string[0],CancellationToken.None).GetAwaiter().GetResult(),"provider_http_202");
  h.Wait=true;using(var cancel=new CancellationTokenSource(10)){Refuses(()=>p.Generate("key","meta/llama-3.1-8b-instruct","{}",true,new string[0],cancel.Token).GetAwaiter().GetResult(),"cancelled_or_timed_out");}h.Wait=false;
  h.Offline=true;Refuses(()=>p.Generate("key","meta/llama-3.1-8b-instruct","{}",true,new string[0],CancellationToken.None).GetAwaiter().GetResult(),"network_unavailable");h.Offline=false;
  h.Code=HttpStatusCode.OK;h.Body="not json";Refuses(()=>p.Generate("key","meta/llama-3.1-8b-instruct","{}",true,new string[0],CancellationToken.None).GetAwaiter().GetResult(),"invalid_provider_response");
  Refuses(()=>p.Generate("key","../../evil","{}",true,new string[0],CancellationToken.None).GetAwaiter().GetResult(),"unsupported_model");
  Refuses(()=>p.Generate("key","meta/llama-3.1-8b-instruct",new string('x',17000),true,new string[0],CancellationToken.None).GetAwaiter().GetResult(),"input_too_large");
  h.Body=new string('x',65537);Refuses(()=>p.Generate("key","meta/llama-3.1-8b-instruct","{}",true,new string[0],CancellationToken.None).GetAwaiter().GetResult(),"output_too_large");
  Refuses(()=>SentinelNim.ValidateAnswer("{\"evidenceRefs\":[\"invented\"],\"explanation\":\"x\",\"uncertainty\":\"x\",\"recommendations\":[]}",new string[0]),"invalid_provider_response");
  Check(SentinelNim.ValidateAnswer("```json\n{\"evidenceRefs\":[],\"explanation\":\"x\",\"uncertainty\":\"x\",\"recommendations\":[]}\n```",new string[0])!=null);
  Check(SentinelNim.ValidateAnswer("{\"evidenceRefs\":[],\"explanation\":\"Hi! What can I help you with?\",\"uncertainty\":\"\",\"recommendations\":[]}",new string[0])!=null);
  Refuses(()=>SentinelNim.ValidateAnswer("{\"evidenceRefs\":[],\"explanation\":\"\",\"uncertainty\":\"\",\"recommendations\":[]}",new string[0]),"invalid_provider_response");
  Console.WriteLine("PASS: consent, endpoint/auth binding, parsing, credential/rate errors, model validation, fabricated evidence refusal");return 0;
 }
}
