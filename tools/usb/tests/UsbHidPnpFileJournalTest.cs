using System;using System.IO;using System.Linq;
internal static class UsbHidPnpFileJournalTest {
 const string A=@"USB\VID_0001&PID_0002&MI_00\A";static int assertions;
 sealed class Ledger:UsbHidPnpFileJournal.ICommittedDisableLedger {internal bool Owned;public bool OwnsDisabled(string id,string tree){return Owned&&id==A&&tree=="tree";}}
 static void Check(bool condition){if(!condition)throw new Exception("PnP journal regression");assertions++;}
 static void Reject(Action a){bool failed=false;try{a();}catch{failed=true;}Check(failed);}
 static UsbHidPnpTransaction.State State(long revision,string phase="Prepared",bool intent=false){var plan=new UsbHidSetupApi.Plan(A,new string('b',64),"tree",8,0,true);return new UsbHidPnpTransaction.State(new string('a',64),"block",new string('c',64),phase,revision,new[]{new UsbHidPnpTransaction.Entry(plan,8,0,true,"tree",intent,false,null,intent?"Intent":"Unchanged",false)});}
 public static int Main(string[] args){var initial=State(0);byte[] encoded=UsbHidPnpFileJournal.Encode(initial);var decoded=UsbHidPnpFileJournal.Decode(encoded);Check(decoded.Digest==initial.Digest&&decoded.Entries[0].Plan.Tree=="tree"&&decoded.Entries[0].Plan.Topology==new string('b',64)&&decoded.Entries[0].BeforeStatus==8&&decoded.Revision==0);Check(UsbHidPnpFileJournal.Encode(decoded).SequenceEqual(encoded));
  var corrupt=(byte[])encoded.Clone();corrupt[25]^=1;Reject(()=>UsbHidPnpFileJournal.Decode(corrupt));Reject(()=>UsbHidPnpFileJournal.Decode(encoded.Take(encoded.Length-1).ToArray()));Reject(()=>UsbHidPnpFileJournal.Decode(encoded.Concat(new byte[]{0}).ToArray()));Reject(()=>UsbHidPnpFileJournal.Encode(State(-1)));Reject(()=>UsbHidPnpFileJournal.Encode(State(0,"unknown")));
  if(args.Length>0){if(args.Length!=2||args[0]!="--protected-private")throw new Exception("Explicit protected fixture arguments required");string nonce=args[1];string path=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"SentinelHidPnpJournalQualification",nonce);Check(Directory.Exists(path));var ledger=new Ledger();int fences=0;bool authorized=true;Action fence=()=>{fences++;if(!authorized)throw new InvalidOperationException("fence withdrawn");};
   using(var journal=UsbHidPnpFileJournal.OpenPrivate(nonce,fence,ledger)){Check(journal.Load(initial.Digest)==null);journal.CompareExchange(-1,initial);Check(journal.Load(initial.Digest).Revision==0);Reject(()=>journal.CompareExchange(-1,initial));Reject(()=>journal.CompareExchange(1,State(2)));journal.CompareExchange(0,State(1,"Applying",true));Check(journal.Load(initial.Digest).Entries[0].Intent);Check(!journal.OwnsDisabled(A,"tree"));ledger.Owned=true;Check(journal.OwnsDisabled(A,"tree"));ledger.Owned=false;Check(!journal.OwnsDisabled(A,"tree"));authorized=false;Reject(()=>journal.Load(initial.Digest));Reject(()=>journal.CompareExchange(1,State(2)));authorized=true;Check(journal.Load(initial.Digest).Revision==1);Check(fences>10);}
   using(var journal=UsbHidPnpFileJournal.OpenPrivate(nonce,()=>{},new Ledger()))Check(journal.Load(initial.Digest).Revision==1);
   Console.WriteLine("PASS protected private fixture new-instance reopen/CAS/fence persistence; ownership ledger is a test fake, no production ownership proof");
  }
  Console.WriteLine("PASS "+assertions+" PnP journal assertions; no device or policy operation");return 0;
 }
}
