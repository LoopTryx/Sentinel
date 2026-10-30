import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec=importlib.util.spec_from_file_location('release_audit',Path(__file__).parents[1]/'audit-release.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ReleaseAuditTests(unittest.TestCase):
    def package(self,directory,extra=None,corrupt=False):
        path=Path(directory)/'test.zip'
        files={'release-version.txt':b'v1.0.0','apps/extension/dist/manifest.json':b'{"version":"1.0.0"}'}
        files.update(extra or {})
        rows=[{'path':name,'sha256':hashlib.sha256(data).hexdigest()} for name,data in files.items()]
        if corrupt:rows[0]['sha256']='0'*64
        with zipfile.ZipFile(path,'w') as archive:
            for name,data in files.items():archive.writestr(name,data)
            archive.writestr('manifest-sha256.json',json.dumps(rows))
        return path

    def test_valid_inventory_and_version(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(module.audit(self.package(directory),'1.0.0')['verifiedFiles'],2)

    def test_private_state_and_path_traversal_are_refused(self):
        for name in ['apps/desktop/profile/Cookies','PrivateHistory/chats.dat','../outside.txt','demo-runtime.json']:
            with self.subTest(name=name),tempfile.TemporaryDirectory() as directory:
                with self.assertRaises(ValueError):module.audit(self.package(directory,{name:b'private'}),'1.0.0')

    def test_corruption_and_wrong_versions_are_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):module.audit(self.package(directory,corrupt=True),'1.0.0')
            with self.assertRaises(ValueError):module.audit(self.package(directory),'2.0.0')

if __name__=='__main__':unittest.main()
