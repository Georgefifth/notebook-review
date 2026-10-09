import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { compare as after } from '../public/core.mjs';
const {stdout}=await promisify(execFile)('git',['show',(process.argv[2]||'d23e03a')+':public/core.mjs']);
const {compare:before}=await import('data:text/javascript;base64,'+Buffer.from(stdout).toString('base64'));
for(const size of [3000,10000]){const cells=Array.from({length:size},(_,i)=>({id:'c'+i,key:'id:c'+i,type:'code',source:'x = '+i,outputs:[],attachments:{}}));const base={cells},revision={cells:cells.map(c=>({...c,source:c.source+' + 1'}))};assert.deepEqual(before(base,revision),after(base,revision));for(let i=0;i<2;i++){before(base,revision);after(base,revision);}const old=[],next=[];for(let i=0;i<9;i++){let t=performance.now();before(base,revision);old.push(performance.now()-t);t=performance.now();after(base,revision);next.push(performance.now()-t);}console.log(JSON.stringify({size,beforeMs:old,afterMs:next,beforeMedianMs:[...old].sort((a,b)=>a-b)[4],afterMedianMs:[...next].sort((a,b)=>a-b)[4]}));}
