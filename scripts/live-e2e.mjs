// Real services only. Run explicitly; never part of the default mocked CI tests.
import { chromium, expect } from '@playwright/test';
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
const failures=[];
try {
  const owner=await account('OWNER'),reviewer=await account('REVIEWER');
  ownerSession=await request('/auth/v1/token?grant_type=password',{method:'POST',body:owner});
  const reviewerSession=await request('/auth/v1/token?grant_type=password',{method:'POST',body:reviewer});
  assert.notEqual(ownerSession.user.id,reviewerSession.user.id);
  for(const session of [ownerSession,reviewerSession]) session.expires_at=Date.now()/1000+session.expires_in;
  browser=await chromium.launch({channel:'chromium',headless:true});
  async function pageFor(session) {
    const context=await browser.newContext();
    await context.addInitScript(value=>sessionStorage.setItem('nr-session',JSON.stringify(value)),session);
    const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));await page.goto(site);
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
  await ownerPage.getByLabel('Collaborator email').fill(reviewer.email);await ownerPage.getByRole('button',{name:'Add',exact:true}).click();await expect(ownerPage.locator('#members')).toContainText(reviewer.email);await ownerPage.getByRole('button',{name:'Close invitation'}).click();
  await reviewerPage.goto(link);await expect(reviewerPage.locator('#project-title')).toContainText('Sample quality');
  await expect(ownerPage.locator('#sync-status')).toHaveText('Live updates',{timeout:20000});await expect(reviewerPage.locator('#sync-status')).toHaveText('Live updates',{timeout:20000});
  for(const page of [ownerPage,reviewerPage]) await page.locator('#cell-1').getByRole('button',{name:'Discuss',exact:true}).click();
  await ownerPage.getByLabel('Your feedback').fill('Owner draft retained during Realtime');
  const marker='Live feedback '+randomUUID();await reviewerPage.getByLabel('Your feedback').fill(marker);await reviewerPage.getByRole('button',{name:'Post feedback'}).click();
  await expect(ownerPage.locator('#comments')).toContainText(marker,{timeout:15000});await expect(ownerPage.getByLabel('Your feedback')).toHaveValue('Owner draft retained during Realtime');
  await ownerPage.getByRole('button',{name:'Mark resolved',exact:true}).click();await expect(reviewerPage.locator('#comments')).toContainText('Resolved');
  await reviewerPage.getByLabel('Your feedback').fill('Reviewer draft retained during revision');
  const revision=await readFile(new URL('../public/examples/revision.ipynb',import.meta.url));await ownerPage.locator('#revision-file').setInputFiles({name:'revision.ipynb',mimeType:'application/json',buffer:revision});
  await expect(reviewerPage.locator('#cell-1')).toContainText('Output changed',{timeout:15000});await expect(reviewerPage.locator('#comments')).toContainText('Revision needs review');await expect(reviewerPage.getByLabel('Your feedback')).toHaveValue('Reviewer draft retained during revision');
  await reviewerPage.getByRole('button',{name:'Confirm revision reviewed',exact:true}).click();await expect(ownerPage.locator('#comments')).not.toContainText('Revision needs review');
  const forbidden=await request('/rest/v1/review_projects?id=eq.'+projectId,{token:reviewerSession.access_token,method:'PATCH',body:{title:'unauthorized edit'}});assert.deepEqual(forbidden,[]);
  await ownerPage.getByRole('button',{name:'Invite collaborators',exact:true}).click();await ownerPage.getByRole('button',{name:'Remove access',exact:true}).click();await expect(ownerPage.locator('#members')).not.toContainText(reviewer.email);
  assert.deepEqual(await request('/rest/v1/review_projects?id=eq.'+projectId,{token:reviewerSession.access_token}),[]);
  await assert.rejects(request('/rest/v1/review_comments',{token:reviewerSession.access_token,method:'POST',body:{project_id:projectId,author_id:reviewerSession.user.id,cell_key:'id:'+JSON.parse(revision).cells[1].id,snapshot_id:liveProject.snapshot_id,body:'must be denied'}}));
  await reviewerPage.getByRole('button',{name:'Refresh review',exact:true}).click();await expect(reviewerPage.locator('#workspace')).toBeHidden();
  assert.deepEqual(failures,[]);
  console.log(JSON.stringify({site,project:config.url,passed:true,independentUsers:2,services:'real Auth password grants, PostgreSQL REST/RLS and Realtime',tested:['uninvited and anonymous denial','owner sharing','invited comments without refresh','revision without refresh','draft preservation','acknowledgement','reviewer cannot edit notebook','revocation read/write denial'],emailOTPDelivery:'not tested; dedicated test accounts use password grants'}));
} finally {
  await browser?.close();
  if(projectId&&ownerSession) { try {await request('/rest/v1/review_projects?id=eq.'+projectId,{token:ownerSession.access_token,method:'DELETE'});}catch{console.error('Cleanup required for test project '+projectId);} }
  for(const id of created) {try{await request('/auth/v1/admin/users/'+id,{adminRequest:true,token:admin,method:'DELETE'});}catch{console.error('Cleanup required for temporary test user '+id);}}
}
