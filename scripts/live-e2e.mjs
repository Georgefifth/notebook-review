// Real services only. Run explicitly; never part of the default mocked CI tests.
import { chromium, firefox, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { publicConfig } from '../config.mjs';
const config = publicConfig();
if (!config.configured) throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
const site = process.env.REVIEW_LIVE_URL || 'https://georgefifth.github.io/notebook-review/';
const admin = process.env.SUPABASE_TEST_ADMIN_KEY;
const created = []; let projectId, ownerSession, browser;
async function request(path, {token, body, method='GET', adminRequest=false} = {}) {
  const response = await fetch(config.url + path, {method,headers:{apikey:adminRequest?admin:config.publicKey,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
  const data = response.status===204?null:await response.json().catch(()=>null);
  if(!response.ok) throw new Error('Live service request failed ('+response.status+') at '+path.split('?')[0]);
  return data;
}
async function account(kind) {
  if(!admin) {
    const email=process.env['REVIEW_'+kind+'_EMAIL'],password=process.env['REVIEW_'+kind+'_PASSWORD'];
    if(!email||!password) throw new Error('Provide two dedicated test accounts or SUPABASE_TEST_ADMIN_KEY through environment variables.');
    return {email,password};
  }
  const email='notebook-review-'+randomUUID()+'@example.org', password=randomUUID()+randomUUID();
  const user=await request('/auth/v1/admin/users',{adminRequest:true,token:admin,method:'POST',body:{email,password,email_confirm:true,user_metadata:{purpose:'notebook-review-e2e'}}});
  created.push(user.id);return{email,password};
}
const failures=[],pages=[],incidents=[],networkFailures=[],consoleErrors=[];const timings={};
const qaMode=process.env.REVIEW_QA==='1';
const engine=process.env.REVIEW_BROWSER==='firefox'?firefox:chromium;
const evidencePrefix=process.env.REVIEW_EVIDENCE_PREFIX||'live';
async function screenshot(page,name){if(qaMode)await page.screenshot({path:'evidence/qa-firefox/'+evidencePrefix+'-'+name+'.png',fullPage:true});}
if(qaMode&&admin)throw Error('QA requires existing accounts; admin account creation/deletion is disabled.');
try {
  const owner=await account('OWNER'),reviewer=await account('REVIEWER');
  ownerSession=await request('/auth/v1/token?grant_type=password',{method:'POST',body:owner});
  const reviewerSession=await request('/auth/v1/token?grant_type=password',{method:'POST',body:reviewer});
  assert.notEqual(ownerSession.user.id,reviewerSession.user.id);
  for(const session of [ownerSession,reviewerSession]) session.expires_at=Date.now()/1000+session.expires_in;
  browser=await engine.launch({...(engine===chromium?{channel:'chromium'}:{}),headless:true});
  async function pageFor(session) {
    const context=await browser.newContext();
    await context.addInitScript(value=>sessionStorage.setItem('nr-session',JSON.stringify(value)),session);
    const page=await context.newPage();pages.push(page);page.on('pageerror',e=>failures.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().replace(/apikey=[^&\"\s]+/g,'apikey=[redacted]'));});page.on('requestfailed',r=>networkFailures.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)incidents.push({status:r.status(),path:new URL(r.url()).pathname});});await page.goto(site);
    const deployed=await page.evaluate(async()=>await(await fetch(new URL('./config.json',location.href))).json());
    assert.equal(deployed.url,config.url);assert.equal(deployed.configured,true);return page;
  }
  const ownerPage=await pageFor(ownerSession),reviewerPage=await pageFor(reviewerSession);
  await ownerPage.getByRole('button',{name:'Open example review →'}).click();
  await ownerPage.getByRole('button',{name:'Share online',exact:true}).click();await ownerPage.getByLabel('Review link',{exact:true}).waitFor();
  const link=await ownerPage.getByLabel('Review link',{exact:true}).inputValue();projectId=new URL(link).searchParams.get('project');assert.ok(projectId);
  const [liveProject]=await request('/rest/v1/review_projects?id=eq.'+projectId,{token:ownerSession.access_token});
  // Reviewer has a real account but no invitation yet.
  assert.deepEqual(await request('/rest/v1/review_projects?id=eq.'+projectId,{token:reviewerSession.access_token}),[]);
  const anonymous=await fetch(config.url+'/rest/v1/review_projects?id=eq.'+projectId,{headers:{apikey:config.publicKey}});assert.ok(anonymous.status===401||anonymous.status===403||(anonymous.ok&&(await anonymous.json()).length===0));
  if(qaMode){await ownerPage.getByRole('button',{name:'Add',exact:true}).click();await expect(ownerPage.getByLabel('Collaborator email')).toBeFocused();await ownerPage.getByRole('button',{name:'Copy link',exact:true}).click();await expect(ownerPage.locator('#share-message')).toContainText(/copied|Copy/i);}
  await ownerPage.getByLabel('Collaborator email').fill(reviewer.email);await ownerPage.getByRole('button',{name:'Add',exact:true}).click();await expect(ownerPage.locator('#members')).toContainText(reviewer.email);await ownerPage.getByRole('button',{name:'Close invitation'}).click();
  await reviewerPage.goto(link);await expect(reviewerPage.locator('#project-title')).toContainText('Sample quality');
  await expect(ownerPage.locator('#sync-status')).toHaveText('Live updates',{timeout:20000});await expect(reviewerPage.locator('#sync-status')).toHaveText('Live updates',{timeout:20000});
  for(const page of [ownerPage,reviewerPage]) await page.locator('#cell-1').getByRole('button',{name:'Discuss',exact:true}).click();
  await ownerPage.getByLabel('Your feedback').fill('Owner draft retained during Realtime');
  if(qaMode){
    await reviewerPage.route(config.url+'/rest/v1/review_comments**',r=>r.request().method()==='POST'?r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'QA temporary service outage; retry.'})}):r.continue());
    await reviewerPage.getByLabel('Your feedback').fill('Retry after temporary outage');await reviewerPage.getByRole('button',{name:'Post feedback'}).click();
    await expect(reviewerPage.locator('#notice')).toContainText('not saved');await expect(reviewerPage.getByLabel('Your feedback')).toHaveValue('Retry after temporary outage');await expect(reviewerPage.getByRole('button',{name:'Post feedback'})).toBeEnabled();await screenshot(reviewerPage,'service-outage');
    await reviewerPage.unroute(config.url+'/rest/v1/review_comments**');
  }
  const marker='Live feedback '+randomUUID();await reviewerPage.getByLabel('Your feedback').fill(marker);await reviewerPage.getByRole('button',{name:'Post feedback'}).click();
  const feedbackStart=Date.now();await expect(ownerPage.locator('#comments')).toContainText(marker,{timeout:15000});timings.feedbackVisibleInOtherBrowserMs=Date.now()-feedbackStart;await expect(ownerPage.getByLabel('Your feedback')).toHaveValue('Owner draft retained during Realtime');
  const persisted=await request('/rest/v1/review_comments?project_id=eq.'+projectId,{token:ownerSession.access_token});assert.ok(persisted.some(c=>c.body===marker));await screenshot(ownerPage,'collaboration');
  if(qaMode){
    // Inject a network abort; native Firefox offline emulation was separately inconclusive.
    await reviewerPage.route(config.url+'/rest/v1/review_comments**',r=>r.request().method()==='POST'?r.abort('internetdisconnected'):r.continue());await reviewerPage.getByLabel('Your feedback').fill('Offline retry feedback');await reviewerPage.getByRole('button',{name:'Post feedback'}).click();await expect(reviewerPage.locator('#notice')).toHaveClass(/error/);await expect(reviewerPage.getByLabel('Your feedback')).toHaveValue('Offline retry feedback');await expect(reviewerPage.getByRole('button',{name:'Post feedback'})).toBeEnabled();await screenshot(reviewerPage,'offline');await reviewerPage.unroute(config.url+'/rest/v1/review_comments**');await reviewerPage.getByRole('button',{name:'Post feedback'}).click();await expect(reviewerPage.locator('#comments')).toContainText('Offline retry feedback');
    const rows=await request('/rest/v1/review_comments?project_id=eq.'+projectId,{token:reviewerSession.access_token});assert.ok(rows.some(c=>c.body==='Offline retry feedback'));await expect(ownerPage.locator('#comments .comment')).toHaveCount(2);
  }
  await ownerPage.locator('.comment').filter({hasText:marker}).getByRole('button',{name:'Mark resolved',exact:true}).click();await expect(reviewerPage.locator('#comments')).toContainText('Resolved');
  await reviewerPage.getByLabel('Your feedback').fill('Reviewer draft retained during revision');
  const revision=await readFile(new URL('../public/examples/revision.ipynb',import.meta.url));await ownerPage.locator('#revision-file').setInputFiles({name:'revision.ipynb',mimeType:'application/json',buffer:revision});
  await expect(reviewerPage.locator('#cell-1')).toContainText('Output changed',{timeout:15000});await expect(reviewerPage.locator('#comments')).toContainText('Revision needs review');await expect(reviewerPage.getByLabel('Your feedback')).toHaveValue('Reviewer draft retained during revision');
  await reviewerPage.locator('.comment').filter({hasText:marker}).getByRole('button',{name:'Confirm revision reviewed',exact:true}).click();await expect(ownerPage.locator('.comment').filter({hasText:marker})).not.toContainText('Revision needs review');await screenshot(reviewerPage,'reviewed-revision');
  if(qaMode){
    // Inject one expired-session response; restore via a controlled verify fixture, NOT proof of email delivery.
    await ownerPage.route(config.url+'/rest/v1/review_projects**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));await ownerPage.getByRole('button',{name:'Refresh review',exact:true}).click();await expect(ownerPage.locator('#workspace')).toBeHidden();await expect(ownerPage.locator('#notice')).toContainText('expired');await ownerPage.unroute(config.url+'/rest/v1/review_projects**');
    await ownerPage.route(config.url+'/auth/v1/otp',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));await ownerPage.route(config.url+'/auth/v1/verify',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(ownerSession)}));
    await ownerPage.getByRole('button',{name:'Sign in with email',exact:true}).click();await ownerPage.getByLabel('Email address').fill(owner.email);await ownerPage.getByRole('button',{name:'Send code',exact:true}).click();await ownerPage.getByLabel('Email verification code').fill('123456');await ownerPage.getByRole('button',{name:'Verify and sign in'}).click();await expect(ownerPage.locator('#workspace')).toBeVisible();await expect(ownerPage.getByLabel('Your feedback')).toHaveValue('Owner draft retained during Realtime');await screenshot(ownerPage,'session-recovery');
    await ownerPage.unroute(config.url+'/auth/v1/otp');await ownerPage.unroute(config.url+'/auth/v1/verify');
  }
  const forbidden=await request('/rest/v1/review_projects?id=eq.'+projectId,{token:reviewerSession.access_token,method:'PATCH',body:{title:'unauthorized edit'}});assert.deepEqual(forbidden,[]);
  await ownerPage.getByRole('button',{name:'Invite collaborators',exact:true}).click();await ownerPage.getByRole('button',{name:'Remove access',exact:true}).click();await expect(ownerPage.locator('#members')).not.toContainText(reviewer.email);
  assert.deepEqual(await request('/rest/v1/review_projects?id=eq.'+projectId,{token:reviewerSession.access_token}),[]);
  await assert.rejects(request('/rest/v1/review_comments',{token:reviewerSession.access_token,method:'POST',body:{project_id:projectId,author_id:reviewerSession.user.id,cell_key:'id:'+JSON.parse(revision).cells[1].id,snapshot_id:liveProject.snapshot_id,body:'must be denied'}}));
  await reviewerPage.getByRole('button',{name:'Refresh review',exact:true}).click();await expect(reviewerPage.locator('#workspace')).toBeHidden();await expect(reviewerPage.locator('#notice')).toContainText('revoked');await expect(reviewerPage.locator('#comment-body')).toHaveValue('Reviewer draft retained during revision');await screenshot(reviewerPage,'revoked');
  await ownerPage.getByRole('button',{name:'Close invitation'}).click();await ownerPage.getByLabel('Your feedback').fill('');await ownerPage.reload();await ownerPage.locator('#cell-1').getByRole('button',{name:/^Discuss/}).click();await expect(ownerPage.locator('#comments')).toContainText(marker);await ownerPage.getByRole('button',{name:'Refresh project list'}).click();await expect(ownerPage.locator('.project-item')).toContainText('Sample quality');await ownerPage.getByRole('button',{name:'Sign out',exact:true}).click();await expect(ownerPage.locator('#workspace')).toBeHidden();await expect(ownerPage.locator('#notice')).toContainText('Signed out');
  assert.deepEqual(incidents.filter(i=>!((i.status===503&&i.path.endsWith('/review_comments'))||(i.status===401&&i.path.endsWith('/review_projects')))),[]);
  assert.deepEqual(networkFailures.filter(i=>i.path!=='/rest/v1/review_comments'),[]);assert.deepEqual(consoleErrors.filter(message=>!message.includes('Cookie “__cf_bm” has been rejected for invalid domain.') && !(networkFailures.some(f=>f.path==='/rest/v1/review_comments') && message.includes('Cross-Origin Request Blocked:') && message.includes('/rest/v1/review_comments. (Reason: CORS request did not succeed)'))),[]);
  assert.deepEqual(failures,[]);
  console.log(JSON.stringify({site,project:config.url,passed:true,browser:engine===firefox?'headless Firefox':'headless Chromium',independentUsers:2,expectedFailureResponses:incidents,expectedOfflineFailures:networkFailures,observedConsoleMessages:consoleErrors,timings,services:'real Auth password grants, PostgreSQL REST/RLS and Realtime',tested:['uninvited and anonymous denial','owner sharing','invited comments without refresh','revision without refresh','draft preservation','acknowledgement','reviewer cannot edit notebook','revocation read/write denial',...(qaMode?['503 draft preservation and real retry','injected network abort and real retry','injected session expiry and controlled same-account recovery','copy link or explicit fallback','required invitation input','refresh persistence','project list refresh','logout']:[])],emailOTPDelivery:'not tested; dedicated test accounts use password grants'}));
} catch(error) {
  for (const page of pages) { console.error('Live UI notice: '+await page.locator('#notice').textContent().catch(()=>'')); const id=new URL(page.url()).searchParams.get('project'); if (!projectId && id && page===pages[0]) projectId=id; }
  throw error;
} finally {
  await browser?.close();
  if(projectId&&ownerSession) { try {await request('/rest/v1/review_projects?id=eq.'+projectId,{token:ownerSession.access_token,method:'DELETE'});}catch{console.error('Cleanup required for test project '+projectId);} }
  for(const id of created) {try{await request('/auth/v1/admin/users/'+id,{adminRequest:true,token:admin,method:'DELETE'});}catch{console.error('Cleanup required for temporary test user '+id);}}
}
