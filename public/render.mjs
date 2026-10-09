// This renderer creates DOM nodes directly. Notebook markup never enters innerHTML.
const node = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
function inline(parent, text) {
  const tokens = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^\s)]+\))/g;
  let start = 0;
  for (const match of text.matchAll(tokens)) {
    parent.append(document.createTextNode(text.slice(start, match.index))); const value = match[0];
    if (value.startsWith('`')) parent.append(node('code', value.slice(1, -1)));
    else if (value.startsWith('**')) parent.append(node('strong', value.slice(2, -2)));
    else if (value.startsWith('*')) parent.append(node('em', value.slice(1, -1)));
    else {
      const parts = value.match(/^\[([^\]]+)\]\((.+)\)$/); let safe = false;
      try { const url = new URL(parts[2]); safe = ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch {}
      if (safe && text[match.index - 1] !== '!') { const link=node('a',parts[1]);link.href=parts[2];link.target='_blank';link.rel='noopener noreferrer';parent.append(link); }
      else parent.append(document.createTextNode(value));
    }
    start = match.index + value.length;
  }
  parent.append(document.createTextNode(text.slice(start)));
}
export function renderMarkdown(container, source) {
  const lines = source.split('\n'); let i = 0;
  const isFence = line => /^\s*```/.test(line);
  const isHeading = line => /^(#{1,6})\s+/.test(line);
  const isList = line => /^\s*(?:[-*+] |\d+\. )/.test(line);
  const isTable = n => n + 1 < lines.length && lines[n].includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[n+1]);
  const columns = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(v=>v.trim());
  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }
    if (isFence(lines[i])) { i++;const code=[];while(i<lines.length&&!isFence(lines[i]))code.push(lines[i++]);if(i<lines.length)i++;const pre=node('pre');pre.className='code';pre.append(node('code',code.join('\n')));container.append(pre);continue; }
    const heading=lines[i].match(/^(#{1,6})\s+(.+)$/);
    if(heading){const h=node('h'+Math.min(6,heading[1].length+1));inline(h,heading[2]);container.append(h);i++;continue;}
    if(isTable(i)) { const wrap=node('div'),table=node('table'),head=node('thead'),tr=node('tr');wrap.className='table-wrap';table.setAttribute('aria-label','Notebook Markdown table');for(const col of columns(lines[i])){const th=node('th');th.scope='col';inline(th,col);tr.append(th);}head.append(tr);table.append(head);i+=2;const body=node('tbody');while(i<lines.length&&lines[i].trim()&&lines[i].includes('|')){const row=node('tr');for(const col of columns(lines[i++])){const td=node('td');inline(td,col);row.append(td);}body.append(row);}table.append(body);wrap.append(table);container.append(wrap);continue; }
    if(isList(lines[i])) {const ordered=/^\s*\d+\. /.test(lines[i]);const list=node(ordered?'ol':'ul');while(i<lines.length&&isList(lines[i])&&/^\s*\d+\. /.test(lines[i])===ordered){const li=node('li');inline(li,lines[i++].replace(/^\s*(?:[-*+] |\d+\. )/,''));list.append(li);}container.append(list);continue;}
    if(/^> ?/.test(lines[i])) {const quote=node('blockquote');const chunk=[];while(i<lines.length&&/^> ?/.test(lines[i]))chunk.push(lines[i++].replace(/^> ?/,''));inline(quote,chunk.join('\n'));container.append(quote);continue;}
    const paragraph=[];
    do {paragraph.push(lines[i++]);}while(i<lines.length&&lines[i].trim()&&!isHeading(lines[i])&&!isFence(lines[i])&&!isList(lines[i])&&!isTable(i)&&!/^> ?/.test(lines[i]));
    const text=node('p');inline(text,paragraph.join('\n'));container.append(text);
  }
}
export function lineDiff(before, after, maxWork = 200000) {
  const a=before.split('\n'),b=after.split('\n');let prefix=0,suffix=0;
  while(prefix<a.length&&prefix<b.length&&a[prefix]===b[prefix])prefix++;
  while(suffix<a.length-prefix&&suffix<b.length-prefix&&a[a.length-1-suffix]===b[b.length-1-suffix])suffix++;
  const x=a.slice(prefix,a.length-suffix),y=b.slice(prefix,b.length-suffix);
  const out=a.slice(0,prefix).map(text=>({kind:'same',text}));
  if(x.length*y.length>maxWork){out.push(...x.map(text=>({kind:'remove',text})),...y.map(text=>({kind:'add',text})));}
  else {const width=y.length+1,dp=new Uint32Array((x.length+1)*width);for(let i=x.length-1;i>=0;i--)for(let j=y.length-1;j>=0;j--)dp[i*width+j]=x[i]===y[j]?1+dp[(i+1)*width+j+1]:Math.max(dp[(i+1)*width+j],dp[i*width+j+1]);let i=0,j=0;while(i<x.length||j<y.length){if(i<x.length&&j<y.length&&x[i]===y[j])out.push({kind:'same',text:x[i++]}),j++;else if(i<x.length&&(j===y.length||dp[(i+1)*width+j]>=dp[i*width+j+1]))out.push({kind:'remove',text:x[i++]});else out.push({kind:'add',text:y[j++]});}}
  out.push(...a.slice(a.length-suffix).map(text=>({kind:'same',text})));return out;
}
export function renderDiff(container, before, after) {
  const details=node('details'),summary=node('summary','View line changes (− original / ＋ revision)');details.append(summary);const pre=node('pre');pre.className='line-diff';
  for(const line of lineDiff(before,after)){const span=node('span',(line.kind==='remove'?'− ':line.kind==='add'?'＋ ':'  ')+line.text+'\n');span.className='diff-'+line.kind;pre.append(span);}details.append(pre);container.append(details);
}
