import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import { access, cp, mkdir, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const ui=new URL('../../ui/',import.meta.url);
if(process.argv.includes('--reuse-shared-ui')){
  // Isolated parity fixtures reuse the already-built UI; normal releases rebuild it.
  await access(new URL('src/console-ui/vault-console.html',root));
}else{
  const shared=spawnSync(process.execPath,[fileURLToPath(new URL('node_modules/vite/bin/vite.js',ui)),'build','--config','vite.extension.config.ts'],{cwd:fileURLToPath(ui),stdio:'inherit'});
  if(shared.status!==0)throw Error('Shared console UI build failed.');
}
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const path of ['manifest.json', 'popup.html', 'field-vault.html', 'xray.html', 'warning.html', 'continue.html', 'data', 'third-party', 'rules', 'src']) {
  await cp(new URL(path, root), new URL(path, dist), { recursive: true });
}
