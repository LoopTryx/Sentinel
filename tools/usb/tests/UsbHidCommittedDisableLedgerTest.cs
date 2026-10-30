using System;
public static class UsbHidCommittedDisableLedgerTest {
 const string A=@"USB\VID_1234&PID_5678\TARGETA",B=@"USB\VID_1234&PID_5678\TARGETB";static readonly string Parent=new string('a',64),Digest=new string('b',64),Binding=ComputeBinding();static int checks;static string ComputeBinding(){var lines=new System.Collections.Generic.List<string>();foreach(var id in new[]{A,B})lines.Add(id.ToUpperInvariant()+"\n"+new string('d',64)+"\n"+"tree-"+id+"\n<missing>\n<missing>");lines.Sort(StringComparer.Ordinal);using(var h=System.Security.Cryptography.SHA256.Create())return BitConverter.ToString(h.ComputeHash(System.Text.Encoding.UTF8.GetBytes("block\n"+string.Join("\n--\n",lines.ToArray())))).Replace("-","");}
 static void Yes(bool b,string name){checks++;if(!b)throw new Exception(name);}static void Refused(Action a){bool refused=false;try{a();}catch(InvalidOperationException){refused=true;}Yes(refused,"authority must refuse");}
 sealed class Source:UsbHidCommittedDisableLedger.IAuthenticatedSource {
  internal UsbHidCommittedDisableLedger.PolicySnapshot Current;internal UsbHidCommittedDisableLedger.ParentCommit Commit;internal UsbHidPnpTransaction.State Journal;internal int Calls,FailAt=-1,Reads;internal bool Race;
  internal void Hit(){if(Calls++==FailAt)throw new InvalidOperationException("injected read/fence fault");}
  public UsbHidCommittedDisableLedger.PolicySnapshot ReadCurrentCommittedPolicy(){Hit();Reads++;if(Race&&Reads>1)return new UsbHidCommittedDisableLedger.PolicySnapshot(3,new string('e',64),false,Current.Receipts);return Current;}
  public UsbHidCommittedDisableLedger.ParentCommit ReadCommittedParentGeneration(long generation){Hit();return Commit;}
  public UsbHidPnpTransaction.State ReadAuthenticatedPnpJournal(string digest){Hit();return Journal;}
 }
 static UsbHidPnpTransaction.Entry Entry(string id){var plan=new UsbHidSetupApi.Plan(id,new string('d',64),"tree-"+id,8,0,true);return new UsbHidPnpTransaction.Entry(plan,8,0,true,plan.Tree,true,true,plan.Tree,"Pending verification",false);}
 static Source Fixture(){var entries=new[]{Entry(A),Entry(B)};var rows=new UsbHidCommittedDisableLedger.Receipt[2];for(int i=0;i<2;i++)rows[i]=new UsbHidCommittedDisableLedger.Receipt(entries[i].Plan.Instance,entries[i].AfterTree,Digest,Binding,Parent,1);return new Source{Current=new UsbHidCommittedDisableLedger.PolicySnapshot(2,new string('f',64),false,rows),Commit=new UsbHidCommittedDisableLedger.ParentCommit(1,Parent,"block",Digest,Binding,new[]{A,B}),Journal=new UsbHidPnpTransaction.State(Digest,"block",Binding,"Committed pending physical verification",5,entries)};}
 static UsbHidCommittedDisableLedger Ledger(Source s){return new UsbHidCommittedDisableLedger(s,s.Hit);}
 static void Main(){
  var s=Fixture();Yes(Ledger(s).OwnsDisabled(A,"tree-"+A),"matching durable parent and committed PnP");
  s=Fixture();Yes(!Ledger(s).OwnsDisabled(A,"changed tree"),"stale exact tree denied");
  s=Fixture();s.Journal=new UsbHidPnpTransaction.State(Digest,"block",Binding,"Applied pending physical verification",4,s.Journal.Entries);Refused(()=>Ledger(s).OwnsDisabled(A,"tree-"+A));
  s=Fixture();s.Commit=new UsbHidCommittedDisableLedger.ParentCommit(1,new string('e',64),"block",Digest,Binding,new[]{A,B});Refused(()=>Ledger(s).OwnsDisabled(A,"tree-"+A));
  s=Fixture();s.Commit=new UsbHidCommittedDisableLedger.ParentCommit(1,Parent,"allow",Digest,Binding,new[]{A,B});Refused(()=>Ledger(s).OwnsDisabled(A,"tree-"+A));
  s=Fixture();var e=s.Journal.Entries;e[0]=e[0].Update(true,true,e[0].AfterTree,"Failed",false);s.Journal=new UsbHidPnpTransaction.State(Digest,"block",Binding,"Committed pending physical verification",5,e);Refused(()=>Ledger(s).OwnsDisabled(A,"tree-"+A));
  s=Fixture();e=s.Journal.Entries;e[0]=e[0].Update(true,true,e[0].AfterTree,"Pending verification",true);s.Journal=new UsbHidPnpTransaction.State(Digest,"block",Binding,"Committed pending physical verification",5,e);Refused(()=>Ledger(s).OwnsDisabled(A,"tree-"+A));
  s=Fixture();s.Race=true;Refused(()=>Ledger(s).OwnsDisabled(A,"tree-"+A));
  s=Fixture();var kept=UsbHidCommittedDisableLedger.RemoveSelectedForAllow(s.Current.Receipts,new[]{A});Yes(kept.Length==1&&kept[0].Instance==B,"Allow-one preserves other receipt");s.Current=new UsbHidCommittedDisableLedger.PolicySnapshot(3,new string('e',64),false,kept);Yes(!Ledger(s).OwnsDisabled(A,"tree-"+A),"selected Allow revokes ownership");Yes(Ledger(s).OwnsDisabled(B,"tree-"+B),"other committed ownership remains");
  s=Fixture();s.Current=new UsbHidCommittedDisableLedger.PolicySnapshot(2,new string('f',64),true,s.Current.Receipts);Refused(()=>Ledger(s).OwnsDisabled(A,"tree-"+A));
  s=Fixture();s.Current=new UsbHidCommittedDisableLedger.PolicySnapshot(2,new string('f',64),false,new[]{s.Current.Receipts[0],s.Current.Receipts[0]});Refused(()=>Ledger(s).OwnsDisabled(A,"tree-"+A));
  for(int at=0;at<10;at++){s=Fixture();s.FailAt=at;bool granted=false;try{granted=Ledger(s).OwnsDisabled(A,"tree-"+A);}catch(InvalidOperationException){}Yes(!granted||s.Calls<=at,"injected fault never grants ownership");}
  Console.WriteLine("PASS "+checks+" committed disable ledger assertions; injected authenticated-source fixtures only");
 }
}

