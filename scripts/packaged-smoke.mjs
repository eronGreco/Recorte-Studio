import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {repoRoot,workRoot,reportsRoot} from './test-paths.mjs';
const app=await electron.launch({executablePath:path.join(repoRoot,'dist/win-unpacked/Recorte Studio.exe'),env:{...process.env,RECORTE_PYTHON:'',PATH:'',RECORTE_TEST_DATA:workRoot+'/installed-smoke-'+Date.now(),RECORTE_TEST_HIDDEN:'1',RECORTE_CAMEO_REPLAY:'1',RECORTE_TEST_UPDATES:JSON.stringify({status:'current',currentVersion:'0.10.0',latestVersion:'0.10.0'})}});
try{
 const page=await app.firstWindow();await page.waitForFunction(()=>window.recorteReady);assert.equal(await app.evaluate(({app})=>app.isPackaged),true);
 const python=await app.evaluate(({app})=>{const load=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/main.cjs'),path=load('node:path'),{execFileSync}=load('node:child_process');const {pythonCommand}=load('./hardware/python-runtime.mjs');const command=pythonCommand();const code='import sys;sys.path.insert(0,'+JSON.stringify(path.join(app.getAppPath(),'hardware'))+');import cameo_worker;print(sys.version.split()[0])';return{command,version:execFileSync(command,['-I','-c',code],{encoding:'utf8',windowsHide:true}).trim(),resources:process.resourcesPath};});
 assert.ok(python.command.startsWith(python.resources));assert.equal(python.version,'3.13.16');await page.locator('#update-notice').waitFor({state:'visible'});await page.locator('#update-dismiss').click();await page.locator('#file-input').setInputFiles(path.join(repoRoot,'test/fixtures/demo-front.png'));await page.waitForFunction(()=>{const root=paper.project.layers.find(l=>l.name==='art').firstChild;return root?.data.traceInfo&&!root.data.pending;});await page.evaluate(()=>window.recorteFlush());await page.screenshot({path:reportsRoot+'/installed-editor.png'});
 console.log('OK: aplicativo empacotado abre sem Node/Python no PATH, importa imagem, calcula corte, salva recuperação e carrega o worker com Python incluído; sem USB.');
}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});await app.close().catch(()=>{});}
