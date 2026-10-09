import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const base=JSON.parse(await readFile(new URL('../../public/examples/base.ipynb',import.meta.url)));
const revision=JSON.parse(await readFile(new URL('../../public/examples/revision.ipynb',import.meta.url)));
async function picture(page,info,name){await page.screenshot({path:`evidence/qa-firefox/${info.project.name}-${name}.png`,fullPage:true});}
async function upload(page,button,notebook,name='review.ipynb'){
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:button,exact:true}).click();
 await (await chooser).setFiles({name,mimeType:'application/json',buffer:Buffer.isBuffer(notebook)?notebook:Buffer.from(JSON.stringify(notebook))});
}
async function example(page){await page.goto('./');await page.getByRole('button',{name:'Open example review →'}).click();await expect(page.locator('.cell')).toHaveCount(4);}
async function discuss(page,index=1){await page.locator(`#cell-${index}`).getByRole('button',{name:/^Discuss/}).click();await expect(page.locator('#discussion-title')).toHaveText(`Cell ${index+1}`);}
test.beforeEach(async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.__qaErrors=errors;
 const incidents=[];page.on('console',m=>{if(m.type()==='error')incidents.push({type:'console',message:m.text().replace(/sb_publishable_\S+/g,'[public key]')});});
 page.on('response',r=>{if(r.status()>=400)incidents.push({type:'http',status:r.status(),path:new URL(r.url()).pathname});});
 page.on('requestfailed',r=>incidents.push({type:'network',path:new URL(r.url()).pathname,error:r.failure()?.errorText}));page.__qaIncidents=incidents;
});
test.afterEach(async({page},info)=>{
 await info.attach('browser-incidents',{body:JSON.stringify(page.__qaIncidents,null,2),contentType:'application/json'});
 expect(page.__qaErrors,'uncaught browser exceptions').toEqual([]);
 // Only the deliberately injected authentication failure test expects failed requests.
 if(!info.title.includes('authentication failure'))expect(page.__qaIncidents,'unexpected console/network/HTTP errors').toEqual([]);
});
test('first visit, keyboard skip link, email form validation and modal recovery',async({page},info)=>{
 await page.goto('./');await expect(page.getByRole('heading',{level:1})).toContainText('Review analysis together');await picture(page,info,'welcome');
 await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to review content'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#workspace-main')).toBeFocused();
 await page.getByRole('button',{name:'Sign in with email',exact:true}).click();await expect(page.getByLabel('Email address')).toBeFocused();
 let submitted=0;page.on('request',r=>{if(r.url().includes('/auth/v1/otp'))submitted++;});
 await page.getByRole('button',{name:'Send code',exact:true}).click();await expect(page.getByLabel('Email address')).toBeFocused();
 await page.getByLabel('Email address').fill('invalid-email');await page.getByRole('button',{name:'Send code',exact:true}).click();expect(submitted).toBe(0);
 await picture(page,info,'invalid-email');await page.keyboard.press('Escape');await expect(page.locator('#login-dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:'Sign in with email',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Open example review →'}).click();await expect(page.locator('.cell')).toHaveCount(4);
});
test('complete local task: feedback, draft protection, revision, acknowledgement, export and refresh persistence',async({page},info)=>{
 await example(page);await discuss(page);await page.getByLabel('Your feedback').fill('QA sample count question');
 await page.locator('#cell-2').getByRole('button',{name:'Discuss',exact:true}).click();await expect(page.locator('#notice')).toContainText('draft');await expect(page.getByLabel('Your feedback')).toHaveValue('QA sample count question');
 await page.getByRole('button',{name:'Post feedback'}).click();await expect(page.locator('.comment')).toContainText('QA sample count question');await expect(page.locator('#notice')).toContainText('saved');
 await page.getByRole('button',{name:'Pending feedback',exact:true}).click();await expect(page.locator('.cell')).toHaveCount(1);await page.getByRole('button',{name:'All cells',exact:true}).click();await expect(page.locator('.cell')).toHaveCount(4);
 await page.getByRole('button',{name:'Mark resolved'}).click();await expect(page.locator('#summary')).toContainText('0 pending');
 await upload(page,'Compare revision',revision);await expect(page.locator('#comments')).toContainText('Revision needs review');await expect(page.locator('#cell-1')).toContainText('Output changed');
 await page.locator('#cell-1 summary').click();await expect(page.locator('#cell-1 .diff-add').first()).toContainText('instrument');await picture(page,info,'revision');
 await page.getByRole('button',{name:'Confirm revision reviewed',exact:true}).click();await expect(page.locator('#summary')).toContainText('0 pending');
 const next=structuredClone(revision);next.cells[1].source+='\nprint(42)';await upload(page,'Compare revision',next,'next.ipynb');await expect(page.locator('#comments')).toContainText('Revision needs review');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export feedback'}).click();const file=await download;const data=JSON.parse(await readFile(await file.path(),'utf8'));expect(JSON.stringify(data)).toContain('QA sample count question');expect(JSON.stringify(data)).toContain('snapshot');
 await page.reload();await page.getByRole('button',{name:'Open example review →'}).click();await discuss(page);await expect(page.locator('.comment')).toContainText('QA sample count question');
 await page.getByRole('button',{name:'Reopen',exact:true}).click();await expect(page.locator('#summary')).toContainText('1 pending');
 await discuss(page,3);await page.getByRole('button',{name:'Next pending feedback',exact:true}).click();await expect(page.locator('#discussion-title')).toHaveText('Cell 2');
 await page.getByLabel('Find content or feedback').fill('QA sample count question');await expect(page.locator('.cell')).toHaveCount(1);await page.getByLabel('Find content or feedback').fill('no-match-123');await expect(page.locator('#cell-list')).toContainText('No cells match');await page.getByLabel('Find content or feedback').fill('');
});
test('invalid uploads preserve saved work and support recovery; empty notebook remains usable',async({page},info)=>{
 await example(page);await discuss(page);await page.getByLabel('Your feedback').fill('Preserve existing feedback');await page.getByRole('button',{name:'Post feedback'}).click();
 const duplicate=structuredClone(base);duplicate.cells[2].id=duplicate.cells[1].id;
 for(const [data,message] of [[Buffer.from('{invalid'),'valid JSON'],[{...base,nbformat:3},'Notebook v4'],[duplicate,'duplicated'],[Buffer.alloc(5*1024*1024+1,32),'5 MB']]){
  await upload(page,'＋ Import Notebook',data,'invalid.ipynb');await expect(page.locator('#notice')).toContainText(message);await expect(page.locator('.cell')).toHaveCount(4);await expect(page.locator('.comment')).toContainText('Preserve existing feedback');
 }
 await picture(page,info,'import-error');await upload(page,'＋ Import Notebook',{nbformat:4,nbformat_minor:5,metadata:{},cells:[]},'empty.ipynb');await expect(page.locator('#summary')).toContainText('0 cells');await expect(page.locator('#cell-list')).toContainText('No cells match');await expect(page.getByRole('button',{name:'Next pending feedback',exact:true})).toBeDisabled();
 await picture(page,info,'empty');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export feedback'}).click();expect(JSON.parse(await readFile(await(await download).path(),'utf8')).comments).toEqual([]);
 await page.getByRole('button',{name:'Try example',exact:true}).click();await expect(page.locator('.cell')).toHaveCount(4);
});
test('whitespace feedback gives actionable validation and a valid retry succeeds',async({page},info)=>{
 await example(page);await discuss(page);await page.getByLabel('Your feedback').fill('   ');await page.getByRole('button',{name:'Post feedback'}).click();await expect(page.locator('.comment')).toHaveCount(0);await expect(page.locator('#notice')).toContainText('Write feedback');await expect(page.getByLabel('Your feedback')).toBeFocused();await picture(page,info,'feedback-validation');
 await page.getByLabel('Your feedback').fill('Valid feedback after correction');await page.getByRole('button',{name:'Post feedback'}).click();await expect(page.locator('.comment')).toContainText('Valid feedback after correction');
});
for(const width of [320,390,768,1440])test(`responsive ${width}px: actual discussion, diff and return navigation`,async({page},info)=>{
 await page.setViewportSize({width,height:width<768?844:1000});await example(page);await discuss(page);await page.getByLabel('Your feedback').fill('Responsive feedback');await page.getByRole('button',{name:'Post feedback'}).click();await expect(page.locator('.comment')).toContainText('Responsive feedback');await page.getByRole('button',{name:'See example changes',exact:true}).click();await page.locator('#cell-1 summary').click();await expect(page.locator('#cell-1 .diff-add')).not.toHaveCount(0);
 if(width<=1100){await page.getByLabel('Your feedback').fill('Retain mobile draft');await page.getByRole('button',{name:'Back to selected cell ↑'}).click();await expect(page.getByLabel('Your feedback')).toHaveValue('Retain mobile draft');expect(await page.locator('#cell-1').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.top<innerHeight;})).toBe(true);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal page overflow').toBe(true);await picture(page,info,`responsive-${width}`);
});
test('keyboard-only review completes a feedback task',async({page})=>{
 await page.goto('./');
 async function tabTo(predicate){for(let n=0;n<80;n++){await page.keyboard.press('Tab');if(await page.evaluate(predicate))return;}throw Error('Keyboard target unreachable');}
 await tabTo(()=>document.activeElement?.id==='welcome-demo');await page.keyboard.press('Enter');await expect(page.locator('.cell')).toHaveCount(4);
 await tabTo(()=>document.activeElement?.closest('#cell-1')&&document.activeElement?.tagName==='BUTTON');await page.keyboard.press('Enter');
 await expect(page.getByLabel('Your feedback')).toBeFocused();await page.keyboard.type('Keyboard-only feedback');await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Post feedback'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('.comment')).toContainText('Keyboard-only feedback');await expect(page.locator('#summary')).toContainText('1 pending');
});
test('authentication failure shows recovery feedback without losing a local review (injected 429)',async({page},info)=>{
 await example(page);await discuss(page);await page.getByLabel('Your feedback').fill('Retain draft during sign-in failure');
 await page.route('**/auth/v1/otp',r=>r.fulfill({status:429,contentType:'application/json',body:JSON.stringify({msg:'Email rate limit exceeded. Please try again later.'})}));
 await page.getByRole('button',{name:'Sign in with email',exact:true}).click();await page.getByLabel('Email address').fill('qa@example.org');await page.getByRole('button',{name:'Send code',exact:true}).click();await expect(page.locator('#auth-message')).toContainText('rate limit');await expect(page.getByRole('button',{name:'Send code',exact:true})).toBeEnabled();await picture(page,info,'auth-error');await page.getByRole('button',{name:'Close sign-in'}).click();await expect(page.getByLabel('Your feedback')).toHaveValue('Retain draft during sign-in failure');await page.getByRole('button',{name:'Post feedback'}).click();await expect(page.locator('.comment')).toContainText('Retain draft during sign-in failure');
 expect(page.__qaIncidents.filter(x=>x.type==='http').map(x=>x.status)).toEqual([429]);
});

test('slow configuration keeps sign-in unavailable until it is ready, then allows the task',async({page},info)=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/config.json',async route=>{await gate;await route.continue();});
 await page.goto('./');await expect(page.getByRole('button',{name:'Sign in with email',exact:true})).toBeDisabled();await expect(page.locator('#mode')).toHaveText('Connecting');await picture(page,info,'connecting');release();
 await page.getByRole('button',{name:'Sign in with email',exact:true}).click();await expect(page.getByLabel('Email address')).toBeFocused();await expect(page.locator('#notice')).not.toContainText('not configured');await page.getByRole('button',{name:'Close sign-in'}).click();await page.getByRole('button',{name:'Open example review →'}).click();await expect(page.locator('.cell')).toHaveCount(4);
});

test('unsafe notebook and feedback render as text without executing or loading remote media',async({page},info)=>{
 await page.goto('./');const hostile=structuredClone(base);hostile.cells[0].source='<script>window.QA_INJECTED=1</script>\n<img src="https://qa-tracker.invalid/a.png" onerror="window.QA_INJECTED=1">';hostile.cells[1].outputs=[{output_type:'display_data',data:{'text/html':'<script>window.QA_INJECTED=1</script>'},metadata:{}}];
 const external=[];page.on('request',r=>{if(r.url().includes('qa-tracker.invalid'))external.push(r.url());});await upload(page,'Import your Notebook',hostile,'hostile.ipynb');await expect(page.locator('#cell-0')).toContainText('<script>');await expect(page.locator('#cell-1')).toContainText('no supported safe preview');await discuss(page);await page.getByLabel('Your feedback').fill('<img src=x onerror="window.QA_INJECTED=1">');await page.getByRole('button',{name:'Post feedback'}).click();await expect(page.locator('.comment')).toContainText('onerror');expect(await page.evaluate(()=>window.QA_INJECTED)).toBeUndefined();expect(external).toEqual([]);await picture(page,info,'safe-preview');
});
test('cancelled navigation retains draft, and returning to the example recovers saved feedback',async({page})=>{
 await example(page);await discuss(page);await page.getByLabel('Your feedback').fill('Saved before navigation');await page.getByRole('button',{name:'Post feedback'}).click();await page.getByLabel('Your feedback').fill('Unsent navigation draft');
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Try example',exact:true}).click();await expect(page.getByLabel('Your feedback')).toHaveValue('Unsent navigation draft');
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('link',{name:'Notebook Review home'}).click();await expect(page.getByLabel('Your feedback')).toHaveValue('Unsent navigation draft');
 await page.getByLabel('Your feedback').fill('');await page.getByRole('link',{name:'Notebook Review home'}).click();await expect(page.locator('#welcome')).toBeVisible();await page.goBack();await page.getByRole('button',{name:'Open example review →'}).click();await discuss(page);await expect(page.locator('.comment')).toContainText('Saved before navigation');
 await page.getByRole('button',{name:'Changes',exact:true}).click();await expect(page.locator('#cell-list')).toContainText('Upload a revised Notebook');await page.getByRole('button',{name:'See example changes',exact:true}).click();await expect(page.locator('#cell-list .cell')).toHaveCount(2);await expect(page.locator('#added-list .cell')).toHaveCount(1);await page.getByRole('button',{name:'All cells',exact:true}).click();await expect(page.locator('#cell-list .cell')).toHaveCount(4);await expect(page.locator('#added-list .cell')).toHaveCount(1);
});
