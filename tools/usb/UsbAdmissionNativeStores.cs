using System;

// Native transaction adapters. Retain a directory pin, NOT the exclusive journal
// stream: independent recovery must be able to open durable intent while the
// console/operator remains alive. The caller retains trusted ancestor pins and
// the cross-process operation lease; no path here is accepted from the renderer.
internal sealed class UsbAdmissionNativeStores : UsbAdmissionTransaction.IConfig,UsbAdmissionTransaction.IJournal,IDisposable {
 readonly string path;readonly SentinelPolicyDirectory pin;readonly object sync=new object();bool disposed;
 internal UsbAdmissionNativeStores(string protectedDirectory){
  path=protectedDirectory;pin=new SentinelPolicyDirectory(path);
  try{using(var config=new UsbEnrollmentConfig(path)){}using(var journal=new UsbAdmissionJournal(path)){} }
  catch{pin.Dispose();throw;}
 }
 void Current(){if(disposed)throw new ObjectDisposedException("UsbAdmissionNativeStores");}
 public UsbEnrollmentConfig.Snapshot ReadCommitted(){lock(sync){Current();using(var config=new UsbEnrollmentConfig(path))return config.ReadCommitted();}}
 public void Commit(ulong expectedGeneration,UsbEnrollmentConfig.Snapshot next){lock(sync){Current();using(var config=new UsbEnrollmentConfig(path))config.Commit(expectedGeneration,next);}}
 public UsbAdmissionJournal.Record Read(){lock(sync){Current();using(var journal=new UsbAdmissionJournal(path))return journal.Read();}}
 public void Arm(UsbAdmissionJournal.Record record){lock(sync){Current();using(var journal=new UsbAdmissionJournal(path))journal.Arm(record);}}
 public void ClearAfterVerifiedRestore(string nonce){lock(sync){Current();using(var journal=new UsbAdmissionJournal(path))journal.ClearAfterVerifiedRestore(nonce);}}
 public void Dispose(){lock(sync){if(disposed)return;disposed=true;pin.Dispose();}}
}
