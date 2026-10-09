import test from 'node:test';
import assert from 'node:assert/strict';
import { ReviewRealtime } from '../public/realtime.mjs';
function fixture() {
  const filters=[], statuses=[];let callback,changes=0,unsubscribed=false,disconnected=false;
  const channel={on(type,filter,fn){filters.push({type,filter,fn});return this;},subscribe(fn){callback=fn;},unsubscribe(){unsubscribed=true;}};
  const client={async setAuth(){},channel(){return channel;},async disconnect(){disconnected=true;}};
  const api={config:{url:'https://example.supabase.co',publicKey:'sb_publishable_test'},async token(){return 'user-jwt';}};
  const realtime=new ReviewRealtime(api,'project',()=>changes++,s=>statuses.push(s),()=>client);
  return {realtime,api,filters,statuses,reply:s=>callback(s),changes:()=>changes,closed:()=>unsubscribed&&disconnected};
}
test('Realtime is scoped to one project, excludes deletes and reconciles every successful join',async()=>{
  const f=fixture();await f.realtime.start();assert.equal(f.filters.length,3);assert.ok(f.filters.every(x=>x.filter.event!=='DELETE'&&x.filter.event!=='*'));
  assert.equal(f.filters[0].filter.filter,'project_id=eq.project');assert.equal(f.filters[2].filter.filter,'id=eq.project');
  f.reply('SUBSCRIBED');f.reply('CHANNEL_ERROR');f.reply('SUBSCRIBED');assert.equal(f.changes(),2);assert.equal(f.statuses.at(-1),'live');
  f.realtime.stop();f.filters[0].fn();f.reply('SUBSCRIBED');assert.equal(f.changes(),2);assert.equal(f.closed(),true);
});
test('stopped subscription cannot start after delayed token refresh',async()=>{
  const f=fixture();let resolve;f.api.token=()=>new Promise(r=>resolve=r);const starting=f.realtime.start();f.realtime.stop();resolve('late');await starting;assert.equal(f.filters.length,0);
});
