import * as recortePaths from './scripts/test-paths.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {runUSB} from './hardware/usb-transport.mjs';
const folder=`${recortePaths.workRoot}/worker-pipe-`+Date.now(),file=folder+'/fixture.py';await fs.mkdir(folder,{recursive:true});
await fs.writeFile(file,`import sys,threading,json,time
sys.path.insert(0,${JSON.stringify(recortePaths.repoRoot+'/hardware')})
import cameo_worker as w
class FakeSession:
 k32=None
 handle=None
 def __init__(self,log):pass
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def _query_ready_initial(self):pass
 def registration(self):w.emit(kind='log',message='FAKE_SCAN')
 def configure_autoblade(self,*args):w.emit(kind='log',message='FAKE_BLADE:'+repr(args))
 def wait_ready(self,timeout):time.sleep(.1)
 def home(self):w.emit(kind='log',message='FAKE_HOME')
w.write_exact=lambda k,h,d:w.emit(kind='log',message='FAKE_PATH:'+d.decode())
lines=w.InputLines(sys.stdin.fileno())
request=json.loads(lines.readline(2000001))
control=w.JobControl()
threading.Thread(target=control.receive,args=(lines,),daemon=True).start()
result=w.run(request['action'],request['job'],session_factory=FakeSession,control=control)
w.emit(kind='result',**result)
`);
const job={settings:{depth:4,force:21,speed:2,passes:2},paths:[{id:'a',body:'M400,400\x03D600,600\x03'},{id:'b',body:'M800,800\x03D900,900\x03'}]};
for(const stop of [false,true]){
 const events=[],controls=[];let paused=false,requested=false;
 const pending=runUSB('cut',job,event=>{
  events.push(event);
  if(event.state==='cutting'&&!requested){requested=true;controls.push(pending.control('pause'));}
  if(event.state==='paused'){paused=true;controls.push(pending.control(stop?'stop':'resume'));}
 },{spawnChild:(python,args,opts)=>{assert.equal(args[0],'-I');assert.ok(args.at(-1).endsWith('cameo_worker.py'));return spawn(python,['-u',file],opts);}});
 const result=await pending;await Promise.all(controls);assert.equal(paused,true);
 assert.equal(result.state,stop?'stopped':'completed');assert.equal(result.completed,stop?1:4);
 assert.equal(events.filter(e=>e.message==='FAKE_SCAN').length,stop?1:2);
 assert.equal(events.filter(e=>e.message?.startsWith('FAKE_PATH:')).length,stop?1:4);
}
console.log('OK: canal Node↔Python real, sem USB; pausa/retomada e parada atravessam stdin; scan repetido; processo encerra sem erro de thread nem duplicar cortes.');
