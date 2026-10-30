using System;
using System.Linq;
class UsbHidAdmissionPolicyTest {
 static int checks;static void Check(bool b){checks++;if(!b)throw new Exception("Assertion "+checks);}
 static void Refuse(Action a){checks++;try{a();}catch(System.IO.InvalidDataException){return;}throw new Exception("Expected refusal "+checks);}
 static string A="USB\\VID_1234&PID_0001\\A",B="USB\\VID_1234&PID_0002\\B",I="USB\\VID_1234&PID_0003\\I",O="S-1-5-21-1-2-3-1001",H=new string('a',64),N=new string('b',32);
 static UsbHidAdmissionPolicy.Snapshot S(ulong g,bool on,string[] approvals){return new UsbHidAdmissionPolicy.Snapshot(g,O,on,new[]{I},approvals,H);}
 static void Main(){var empty=S(1,false,new string[0]);Check(UsbHidAdmissionPolicy.Decode(UsbHidAdmissionPolicy.Encode(empty)).Digest==empty.Digest);var now=DateTime.UtcNow;var active=S(2,true,new string[0]);var r=new UsbHidAdmissionPolicy.Request("activate",empty,active,new string[0],N,H,now,now.AddMinutes(5));Check(UsbHidAdmissionPolicy.DecodeRequest(UsbHidAdmissionPolicy.Encode(r)).Digest==r.Digest);
 var both=S(3,true,new[]{A,B});Refuse(()=>new UsbHidAdmissionPolicy.Request("allow",active,both,new[]{A},N,H,now,now.AddMinutes(5)));var one=S(4,true,new[]{B});new UsbHidAdmissionPolicy.Request("block",both,one,new[]{A},N,H,now,now.AddMinutes(5));Check(one.ExternalApprovals.SequenceEqual(new[]{B}));Refuse(()=>new UsbHidAdmissionPolicy.Request("block",both,one,new[]{I},N,H,now,now.AddMinutes(5)));
 var changed=UsbHidAdmissionPolicy.Encode(empty);changed[9]^=1;Refuse(()=>UsbHidAdmissionPolicy.Decode(changed));Refuse(()=>UsbHidAdmissionPolicy.Decode(changed.Take(10).ToArray()));Refuse(()=>new UsbHidAdmissionPolicy.Request("activate",empty,active,new string[0],N,H,now,now.AddMinutes(6)));Refuse(()=>new UsbHidAdmissionPolicy.Request("activate",empty,S(3,true,new string[0]),new string[0],N,H,now,now.AddMinutes(5)));
  var allowed=S(3,true,new[]{A});var aq=new UsbHidAdmissionPolicy.Request("allow",active,allowed,new[]{A},N,H,now,now.AddMinutes(5));Check(allowed.ExternalApprovals.SequenceEqual(new[]{A}));Check(UsbHidAdmissionPolicy.CompilerApprovals(allowed).OrderBy(x=>x).SequenceEqual(new[]{A,I}.OrderBy(x=>x)));
 var deactivated=S(4,false,new[]{A});new UsbHidAdmissionPolicy.Request("deactivate",allowed,deactivated,new string[0],N,H,now,now.AddMinutes(5));Refuse(()=>UsbHidAdmissionPolicy.CompilerApprovals(deactivated));
 Refuse(()=>new UsbHidAdmissionPolicy.Request("allow",active,allowed,new[]{I},N,H,now,now.AddMinutes(5)));Refuse(()=>new UsbHidAdmissionPolicy.Request("allow",active,allowed,new[]{A},N,H,DateTime.Now,now.AddMinutes(5)));
 Refuse(()=>new UsbHidAdmissionPolicy.Request("activate",empty,active,new[]{A},N,H,now,now.AddMinutes(5)));Refuse(()=>new UsbHidAdmissionPolicy.Request("activate",empty,new UsbHidAdmissionPolicy.Snapshot(2,O,true,new[]{B},new string[0],H),new string[0],N,H,now,now.AddMinutes(5)));
 Refuse(()=>new UsbHidAdmissionPolicy.Request("activate",empty,new UsbHidAdmissionPolicy.Snapshot(2,O,true,new[]{I},new string[0],new string('c',64)),new string[0],N,H,now,now.AddMinutes(5)));
 aq.ValidateFresh(active,now);Refuse(()=>aq.ValidateFresh(allowed,now));Refuse(()=>aq.ValidateFresh(active,now.AddMinutes(5)));Refuse(()=>aq.ValidateFresh(active,now.AddTicks(-1)));
 var rb=UsbHidAdmissionPolicy.Encode(aq);Refuse(()=>UsbHidAdmissionPolicy.DecodeRequest(rb.Concat(new byte[]{0}).ToArray()));Refuse(()=>UsbHidAdmissionPolicy.DecodeRequest(rb.Take(rb.Length-1).ToArray()));
 Refuse(()=>new UsbHidAdmissionPolicy.Snapshot(1,O,true,new[]{I,I},new string[0],H));Refuse(()=>new UsbHidAdmissionPolicy.Snapshot(1,O,true,new[]{I},new[]{I},H));Refuse(()=>new UsbHidAdmissionPolicy.Snapshot(1,O,true,new[]{I},Enumerable.Range(0,257).Select(x=>"USB\\VID_1234&PID_0002\\B"+x).ToArray(),H));
 var max=new UsbHidAdmissionPolicy.Snapshot(1,O,true,new[]{I},Enumerable.Range(0,31).Select(x=>"USB\\VID_1234&PID_0002\\B"+x).ToArray(),H);Check(UsbHidAdmissionPolicy.Decode(UsbHidAdmissionPolicy.Encode(max)).ExternalApprovals.Length==31);
 Refuse(()=>new UsbHidAdmissionPolicy.Snapshot(1,O,true,Enumerable.Range(0,33).Select(x=>"USB\\VID_1234&PID_0002\\B"+x).ToArray(),new string[0],H));
  Refuse(()=>new UsbHidAdmissionPolicy.Snapshot(1,O,true,new[]{I},Enumerable.Range(0,32).Select(x=>"USB\\VID_1234&PID_0002\\B"+x).ToArray(),H));
 Refuse(()=>new UsbHidAdmissionPolicy.Snapshot(1,O,true,new[]{I},Enumerable.Range(0,25).Select(x=>"USB\\VID_1234&PID_0002\\"+new string('A',170)+x).ToArray(),H));
 var journal=new UsbHidAdmissionPolicy.Transition(aq,UsbHidAdmissionPolicy.Stage.PolicyVerified);var jb=UsbHidAdmissionPolicy.Encode(journal);Check(UsbHidAdmissionPolicy.DecodeTransition(jb).Request.Digest==aq.Digest);Check(UsbHidAdmissionPolicy.DecodeTransition(jb).Phase==UsbHidAdmissionPolicy.Stage.PolicyVerified);Check(UsbHidAdmissionPolicy.Same(active,UsbHidAdmissionPolicy.Decode(UsbHidAdmissionPolicy.Encode(active))));Check(UsbHidAdmissionPolicy.Same(null,null));Check(!UsbHidAdmissionPolicy.Same(active,null));Refuse(()=>new UsbHidAdmissionPolicy.Transition(aq,(UsbHidAdmissionPolicy.Stage)22));jb[8]^=1;Refuse(()=>UsbHidAdmissionPolicy.DecodeTransition(jb));
 var ids=both.ExternalApprovals;ids[0]=I;Check(both.ExternalApprovals[0]==A);Console.WriteLine("PASS HID admission policy "+checks+" assertions");}
}


