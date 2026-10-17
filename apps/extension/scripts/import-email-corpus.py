"""Offline research fixture import. Fetches CSV text only; never follows email links.
Sources declare CC BY-SA 4.0. No corpus is shipped in extension dist.
"""
import csv,io,json,re,hashlib,urllib.request
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit
csv.field_size_limit(16000000)
root=Path(__file__).resolve().parents[1]
records=[]
for filename,label in [('Nazario.csv',1),('SpamAssasin.csv',0)]:
 url='https://raw.githubusercontent.com/rokibulroni/Phishing-Email-Dataset/main/'+filename
 with urllib.request.urlopen(url,timeout=30) as response:
  data=response.read(16000001)
 if len(data)>16000000:raise ValueError('Dataset exceeds import bound')
 rows=list(csv.DictReader(io.StringIO(data.decode('utf-8-sig'))))
 candidates=[]
 for index,row in enumerate(rows):
  body=row.get('body') or ''
  if row.get('label')!=str(label) or not 40<len(body)<=8192:continue
  digest=hashlib.sha256(body.encode()).hexdigest()
  candidates.append((digest,index,row))
 selected=sorted(candidates)[:50]
 for sequence,(digest,index,row) in enumerate(selected):
  links=[]
  def redact_url(match):
   try:
    parsed=urlsplit(match.group().rstrip('.,);'))
    hostname=parsed.hostname
    if not hostname:return '[link]'
    path='/login' if re.search(r'login|signin|verify',parsed.path,re.I) else '/'
    clean=urlunsplit(('https',hostname,path,'',''))
    links.append({'text':'Open link','destination':clean})
    return clean
   except ValueError:return '[link]'
  body=re.sub(r'https?://[^\s<>"\']+',redact_url,row['body'],flags=re.I)
  body=re.sub(r'[\w.+-]+@[\w.-]+','[address]',body)
  body=re.sub(r'(?<!\w)\+?\d[\d ()-]{7,}\d','[number]',body)
  body=re.sub(r'(?im)^(?:from|to|cc|bcc|reply-to|message-id|received|return-path):.*$','[header removed]',body)
  body=re.sub(r'(?im)^(dear|hello|hi)\s+[^,\n]{1,70},',r'\1 recipient,',body)
  records.append({'id':filename+'-'+str(index),'source':url,'sourceBodySha256':digest,'label':'scam' if label else 'legitimate','split':'comparison' if sequence%5==0 else 'tuning','email':{'subject':None,'body':body[:8192],'sender':{'address':None,'name':None},'links':links[:64],'attachments':[],'authentication':{}}})
records.extend(json.loads((root/'test/fixtures/email-legitimate-notifications.json').read_text(encoding='utf-8')))
(root/'test/fixtures/email-corpus.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'samples':len(records),'scam':sum(r['label']=='scam' for r in records),'legitimate':sum(r['label']=='legitimate' for r in records)}))
