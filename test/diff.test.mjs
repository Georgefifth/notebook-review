import test from 'node:test';
import assert from 'node:assert/strict';
import { lineDiff } from '../public/render.mjs';
function roundtrip(before,after,limit){const rows=lineDiff(before,after,limit);assert.equal(rows.filter(r=>r.kind!=='add').map(r=>r.text).join('\n'),before);assert.equal(rows.filter(r=>r.kind!=='remove').map(r=>r.text).join('\n'),after);}
test('line diffs reconstruct both sources including repeated lines, blank lines and full replacement',()=>{for(const [a,b]of [['a\nb\nc','a\nx\nc'],['','x'],['x',''],['a\na\nb','a\nb\na'],['a\n','a'],['<script>','<img>'],['a\nb\nc','x\ny\nz']]){roundtrip(a,b);roundtrip(a,b,0);}});
test('large diff falls back to a bounded replacement without dropping content',()=>{roundtrip(Array.from({length:1000},(_,i)=>'old'+i).join('\n'),Array.from({length:1000},(_,i)=>'new'+i).join('\n'));});
