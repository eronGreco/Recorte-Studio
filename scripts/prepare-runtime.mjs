import fs from 'node:fs/promises';
import extract from 'extract-zip';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),version='3.13.16';
const hash='97dae5274cc54867065e8d5a3226e48c35017ed332a0fdb0e27d5b5821961297';
const runtime=path.join(root,'runtime/python'),archive=path.join(root,'runtime/python-'+version+'.zip');
await fs.mkdir(runtime,{recursive:true});
let zip;try{zip=await fs.readFile(archive);}catch{}
if(!zip||createHash('sha256').update(zip).digest('hex')!==hash){const response=await fetch(`https://www.python.org/ftp/python/${version}/python-${version}-embed-amd64.zip`,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Não foi possível baixar o Python oficial.');zip=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(zip).digest('hex')!==hash)throw Error('O SHA-256 do Python não confere.');await fs.writeFile(archive,zip);}
await extract(archive,{dir:runtime});
await fs.writeFile(path.join(runtime,'runtime-version.json'),JSON.stringify({version,sha256:hash,source:'https://www.python.org/downloads/release/python-31316/'},null,2));
execFileSync(path.join(runtime,'python.exe'),['-I','-c','import ctypes,json,queue,threading; print("Python embutido pronto")'],{windowsHide:true,stdio:'inherit'});
