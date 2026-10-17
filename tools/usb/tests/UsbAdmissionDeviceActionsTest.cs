using System;
internal static class UsbAdmissionDeviceActionsTest {
 static void Check(bool value){if(!value)throw new Exception("Device card action regression");}
 static int Main(){Check(UsbAdmissionDeviceActions.Status(false,false,false)=="Windows access state unverified");Check(UsbAdmissionDeviceActions.Status(true,true,true)=="Built-in · protected");Check(UsbAdmissionDeviceActions.Status(false,false,false,true)=="Not restricted · approval required");Check(UsbAdmissionDeviceActions.Status(false,true,false)=="Restricted by Windows rule");Check(UsbAdmissionDeviceActions.Status(false,true,true)=="Allowed by Windows rule");Check(UsbAdmissionDeviceActions.Change(new[]{"a","b"},"a",false).Length==1);Check(UsbAdmissionDeviceActions.Change(new[]{"a"},"b",true).Length==2);Check(UsbAdmissionDeviceActions.Change(new[]{"a"},"A",true).Length==1);Console.WriteLine("PASS device card status distinguishes inactive rules and exact approval changes");return 0;}
}
