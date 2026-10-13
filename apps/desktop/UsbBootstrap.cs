using System;
// Dedicated elevated recovery bootstrap; no renderer, IPC, plugins or other launches.
// Installation/startup recovery and the broker executable remain separate gates.
internal static class UsbBootstrap {
 [STAThread]static int Main(string[] args){
  if(args.Length!=0)return 2;
  try{
   using(var journal=ProtectedUsbJournal.OpenMachine())
   using(var child=UsbJournalTransport.StartMachine(journal)){
    if(!child.WaitForExit(30000))return 3;
    return child.ExitCode==0?0:1;
   }
  }catch{return 1;}
 }
}
