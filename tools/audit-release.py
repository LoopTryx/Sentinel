"""Verify a Sentinel ZIP or appended-payload installer without executing its contents."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import struct
import zipfile

PRIVATE = re.compile(r'(?i)(^|/)(?:demo-runtime\.json|native-host\.json|chats\.dat|vault\.json|windows-key[^/]*|\.env(?:\..*)?|[^/]*\.(?:log|pdb))$|(?:^|/)(?:profile(?:-smoke)?|PrivateHistory|RecoveryBackups|PresentationBackup-[^/]*|node_modules|\.git)(?:/|$)')

def audit(path, expected_version=None):
    path=Path(path)
    if path.suffix.lower()=='.exe':
        with path.open('rb') as source:
            source.seek(-16,2)
            length,marker=struct.unpack('<q8s',source.read(16))
            if marker!=b'SNTLZIP6' or length<=0 or length>path.stat().st_size-16:raise ValueError('Invalid appended payload footer')
    with zipfile.ZipFile(path) as archive:
        files=[entry for entry in archive.infolist() if not entry.is_dir()]
        names=set()
        for entry in files:
            name=entry.filename.replace('\\','/')
            if name.startswith('/') or '..' in PurePosixPath(name).parts or ':' in name or PRIVATE.search(name):raise ValueError('Forbidden payload path: '+name)
            if name.lower() in names:raise ValueError('Duplicate payload path: '+name)
            names.add(name.lower())
        raw=json.loads(archive.read('manifest-sha256.json').decode('utf-8-sig'))
        rows=raw if isinstance(raw,list) else [raw]
        expected={row['path'].replace('\\','/'):row['sha256'].lower() for row in rows}
        if len(expected)!=len(rows) or len(files)!=len(rows)+1:raise ValueError('Manifest inventory mismatch')
        for name,digest in expected.items():
            sha=hashlib.sha256()
            with archive.open(name) as stream:
                while chunk:=stream.read(1024*1024):sha.update(chunk)
            if sha.hexdigest()!=digest:raise ValueError('Hash mismatch: '+name)
        version=archive.read('release-version.txt').decode('utf-8-sig').strip()
        extension=json.loads(archive.read('apps/extension/dist/manifest.json'))['version']
        if expected_version and (version!='v'+expected_version or extension!=expected_version):raise ValueError('Release/extension version mismatch')
        return {'version':version,'extensionVersion':extension,'verifiedFiles':len(rows),'privateStatePaths':0,'sha256':hashlib.file_digest(path.open('rb'),'sha256').hexdigest()}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('path');parser.add_argument('--version');parser.add_argument('--output');args=parser.parse_args()
    result=audit(args.path,args.version)
    rendered=json.dumps(result,indent=2)
    if args.output:Path(args.output).write_text(rendered+'\n',encoding='utf-8')
    print(rendered)
