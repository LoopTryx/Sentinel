using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public sealed class SentinelPolicyDirectory : IDisposable {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern SafeFileHandle CreateFile(string path,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
 [StructLayout(LayoutKind.Sequential)] struct Info {public uint attributes;public System.Runtime.InteropServices.ComTypes.FILETIME creation,access,write;public uint volume,sizeHigh,sizeLow,links,indexHigh,indexLow;}
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle handle,out Info info);
 [StructLayout(LayoutKind.Sequential)] struct Security {public int size;public IntPtr descriptor;public int inherit;}
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string text,uint revision,out IntPtr descriptor,out uint size);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateDirectory(string path,ref Security security);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
 public static void Provision(string path){IntPtr descriptor;uint size;if(!ConvertStringSecurityDescriptorToSecurityDescriptor("O:BAG:BAD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)",1,out descriptor,out size))throw new InvalidOperationException("Recovery descriptor failed");try{Security security=new Security{size=Marshal.SizeOf(typeof(Security)),descriptor=descriptor,inherit=0};if(!CreateDirectory(path,ref security)&&Marshal.GetLastWin32Error()!=183)throw new InvalidOperationException("Recovery provision failed");}finally{LocalFree(descriptor);}}
 readonly SafeFileHandle handle;
 public SentinelPolicyDirectory(string path){handle=CreateFile(path,0x80000000,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);Info info;if(handle.IsInvalid||!GetFileInformationByHandle(handle,out info)||(info.attributes&0x400)!=0||(info.attributes&0x10)==0){handle.Dispose();throw new InvalidOperationException("Unsafe recovery directory");}}
 public void Dispose(){handle.Dispose();}
}
