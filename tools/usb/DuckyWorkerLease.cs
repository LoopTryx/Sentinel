using System;
using System.Globalization;

// Scheduling policy only. Does not start tasks, change policy or control devices.
public sealed class DuckyWorkerLease {
 public readonly int Seconds;
 public readonly DateTime LatestStartUtc;
 public readonly DateTime RecoveryDeadlineUtc;
 DuckyWorkerLease(int seconds,DateTime latest,DateTime recovery){Seconds=seconds;LatestStartUtc=latest;RecoveryDeadlineUtc=recovery;}
 static void Utc(DateTime time){if(time.Kind!=DateTimeKind.Utc)throw new ArgumentException("UTC timestamps required");}
 public static DuckyWorkerLease Create(DateTime now,DateTime proposedRecovery,DateTime? outstandingRecovery){
  Utc(now);Utc(proposedRecovery);if(outstandingRecovery.HasValue)Utc(outstandingRecovery.Value);
  DateTime recovery=outstandingRecovery.HasValue&&outstandingRecovery.Value<proposedRecovery?outstandingRecovery.Value:proposedRecovery;
  double available=(recovery-now).TotalSeconds-15;
  if(available<10)throw new InvalidOperationException("Insufficient recovery time; no worker may start");
  // Reserve dispatch slack as well as runtime. The worker must check LatestStart
  // before acquiring the GPO mutex; a queued task cannot reuse a stale budget.
  int seconds=(int)Math.Min(180,Math.Floor(available/2));
  return new DuckyWorkerLease(seconds,recovery.AddSeconds(-15-seconds),recovery);
 }
 public bool CanStart(DateTime actualStart){Utc(actualStart);return actualStart<=LatestStartUtc;}
 // Caller must obtain these fields from its protected receipt. This validates
 // arithmetic and types only; it does not authenticate caller-provided data.
 public static DuckyWorkerLease Rehydrate(int seconds,DateTime latestStart,DateTime recovery){
  Utc(latestStart);Utc(recovery);
  if(seconds<5||seconds>180||latestStart>recovery.AddSeconds(-15-seconds))throw new ArgumentException("Invalid persisted worker budget");
  return new DuckyWorkerLease(seconds,latestStart,recovery);
 }
 public string ExecutionTimeLimit {get{return "PT"+Seconds.ToString(CultureInfo.InvariantCulture)+"S";}}
}
