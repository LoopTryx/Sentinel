using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

// Appended ZIP avoids a second payload file and the CLR resource-size limit.
internal static class InstallerPayload {
 internal static Stream Open(string path,string expected){
  var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read);
  try {
   if(file.Length<16)throw new IOException("This installer is incomplete. Download it again.");
   file.Position=file.Length-16;var reader=new BinaryReader(file);
   long length=reader.ReadInt64();string marker=Encoding.ASCII.GetString(reader.ReadBytes(8));
   if(marker!="SNTLZIP6"||length<=0||length>file.Length-16)throw new IOException("This installer is incomplete. Download it again.");
   var slice=new Slice(file,file.Length-16-length,length);
   using(var sha=SHA256.Create()){
    string actual=BitConverter.ToString(sha.ComputeHash(slice)).Replace("-","").ToLowerInvariant();
    if(actual!=expected)throw new IOException("Installer integrity check failed. Download Sentinel again.");
   }
   slice.Position=0;return slice;
  }catch{file.Dispose();throw;}
 }
 sealed class Slice:Stream {
  readonly FileStream file;readonly long start,length;long position;
  internal Slice(FileStream file,long start,long length){this.file=file;this.start=start;this.length=length;file.Position=start;}
  public override bool CanRead{get{return true;}}public override bool CanSeek{get{return true;}}public override bool CanWrite{get{return false;}}
  public override long Length{get{return length;}}public override long Position{get{return position;}set{Seek(value,SeekOrigin.Begin);}}
  public override int Read(byte[] buffer,int offset,int count){if(buffer==null)throw new ArgumentNullException("buffer");if(offset<0||count<0||offset>buffer.Length-count)throw new ArgumentOutOfRangeException();int n=file.Read(buffer,offset,(int)Math.Min(count,length-position));position+=n;return n;}
  public override long Seek(long offset,SeekOrigin origin){long target;try{checked{target=(origin==SeekOrigin.Begin?0:origin==SeekOrigin.Current?position:origin==SeekOrigin.End?length:throwOrigin())+offset;}}catch(OverflowException){throw new IOException("Invalid payload offset.");}if(target<0||target>length)throw new IOException("Invalid payload offset.");file.Position=start+target;position=target;return target;}
  static long throwOrigin(){throw new ArgumentException("Invalid seek origin.");}
  public override void Flush(){}public override void SetLength(long value){throw new NotSupportedException();}public override void Write(byte[] buffer,int offset,int count){throw new NotSupportedException();}
  protected override void Dispose(bool disposing){if(disposing)file.Dispose();base.Dispose(disposing);}
 }
}
