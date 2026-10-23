const $ = selector => document.querySelector(selector);
const input = $('#file-input'), drop = $('#dropzone'), list = $('#file-list');
const appleDevice=/Mac|iPhone|iPad/.test(navigator.userAgentData?.platform||navigator.platform);
$('#paste-shortcut').textContent=appleDevice?'⌘ V':'Ctrl V';
const items = [];
let current = null, serial = 0, toolMode = 'compress';
function setMode(mode) {
  toolMode=mode;
  const convert=mode==='convert';
  $('#mode-compress').setAttribute('aria-pressed',String(!convert));
  $('#mode-convert').setAttribute('aria-pressed',String(convert));
  $('#drop-title').textContent=convert?'Drop your images here':'Drop your PNGs here';
  drop.dataset.prompt=convert?'Drop to convert to PNG.':'Drop your PNGs here.';
  $('#format-hint').textContent=convert?'JPG · WebP · AVIF · HEIC · Up to 50 MB':'PNG only · Up to 50 MB each';
  $('#intro-copy').textContent=convert?'Your photos, now PNGs. Still on your device.':'Smaller PNGs. Every pixel kept.';
  $('#quality-label').textContent=convert?'PNG may be larger':'Always lossless';
  $('#secondary-label').textContent=convert?'Photo metadata removed':'Transparency preserved';
  $('#add-more').lastChild.textContent=convert?' Add images':' Add PNGs';
  input.accept=convert?'image/jpeg,image/webp,image/avif,image/heic,image/heif,.jpg,.jpeg,.webp,.avif,.heic,.heif':'image/png,.png';
  notify('');
}
$('#mode-compress').addEventListener('click',()=>setMode('compress'));
$('#mode-convert').addEventListener('click',()=>setMode('convert'));
setMode('compress');
const MAX_BYTES = 50 * 1024 * 1024;
const icons = {
  download:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M10 3v10m-4-4 4 4 4-4M4 14v3h12v-3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  remove:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8" stroke-linecap="round"/></svg>'
};
const emptyState = $('#empty-state'), results = $('#results');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const motions = new Set(), rows = new Map();
const settle = 'cubic-bezier(.22, 1, .36, 1)';
function motion(node, frames, options = {}) {
  if (reducedMotion.matches || !node.animate) return;
  const animation = node.animate(frames, {duration: 240, easing: settle, ...options});
  const finish = () => motions.delete(stop);
  const stop = () => { animation.cancel(); finish(); };
  motions.add(stop);
  animation.onfinish = finish;
  animation.oncancel = finish;
}
function stopMotion() { for (const stop of [...motions]) stop(); }
window.addEventListener('resize', stopMotion);
window.addEventListener('pagehide', stopMotion);
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopMotion(); });
function visibleRow(row) {
  const box = row.getBoundingClientRect(), viewport = list.getBoundingClientRect();
  return box.bottom > viewport.top && box.top < viewport.bottom;
}
function bytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024*1024) return `${(value/1024).toFixed(value<10240?1:0)} KB`;
  return `${(value/(1024*1024)).toFixed(2)} MB`;
}
function notify(message) { $('#notice').textContent = message; $('#notice').hidden = !message; }
$('#choose').addEventListener('click',()=>input.click());
$('#add-more').addEventListener('click',()=>input.click());
input.addEventListener('change',()=>{ addFiles([...input.files]); input.value=''; });
// Use the user's native paste action; no background clipboard access is needed.
document.addEventListener('paste', event => {
  if (event.defaultPrevented || !event.clipboardData) return;
  const target = event.target;
  if (target instanceof Element && target.closest('textarea, input:not([type="file"]), [contenteditable="true"]')) return;
  const clipboard = event.clipboardData;
  let files = Array.from(clipboard.files || []);
  if (!files.length) {
    files = Array.from(clipboard.items || [])
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter(Boolean);
  }
  if (!files.length) return;
  event.preventDefault();
  addFiles(files);
});
let dragDepth = 0;
document.addEventListener('dragover',event=>{if(event.dataTransfer?.types.includes('Files'))event.preventDefault();});
document.addEventListener('drop',event=>{if(event.dataTransfer?.files.length)event.preventDefault();});
drop.addEventListener('dragenter',event=>{event.preventDefault();dragDepth++;drop.classList.add('dragging');});
drop.addEventListener('dragover',event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';});
drop.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;drop.classList.remove('dragging');}});
drop.addEventListener('drop',event=>{event.preventDefault();dragDepth=0;drop.classList.remove('dragging');addFiles([...event.dataTransfer.files]);});
function addFiles(files) {
  notify('');
  const skipped=[];
  for(const file of files){
    if(toolMode==='compress' && file.type!=='image/png'&&!/\.png$/i.test(file.name)){skipped.push(`${file.name}: choose a PNG, or switch to Convert to PNG.`);continue;}
    if(toolMode==='convert' && !/^image\/(jpeg|webp|avif|heic|heif)$/.test(file.type) && !/\.(jpe?g|webp|avif|heic|heif)$/i.test(file.name)){skipped.push(`${file.name}: choose a JPG, WebP, AVIF or HEIC photo.`);continue;}
    if(file.size>MAX_BYTES){skipped.push(`${file.name}: exceeds the 50 MB limit.`);continue;}
    if(items.length>=50 || items.reduce((s,i)=>s+i.file.size,0)+file.size>250*1024*1024){skipped.push('This batch is full. Download and clear it before adding more images.');break;}
    const item={id:++serial,file,operation:toolMode,status:'queued',url:null,preview:null};
    items.push(item);
  }
  if(skipped.length)notify(skipped.join(' '));
  render();processNext();
}
function removeItem(id){
  const index=items.findIndex(item=>item.id===id);
  if(index<0)return;
  const [item]=items.splice(index,1);
  if(current?.item===item){current.worker.terminate();clearTimeout(current.timer);current=null;}
  if(item.url)URL.revokeObjectURL(item.url);
  if(item.preview)URL.revokeObjectURL(item.preview);
  render();processNext();
}
$('#clear').addEventListener('click',()=>{
  if(current){current.worker.terminate();clearTimeout(current.timer);current=null;}
  for(const item of items){if(item.url)URL.revokeObjectURL(item.url);if(item.preview)URL.revokeObjectURL(item.preview);}
  items.length=0;notify('');render();
});
async function processNext(){
  if(current)return;
  const item=items.find(i=>i.status==='queued');if(!item)return;
  item.status='working';
  let worker;
  try { worker=new Worker(new URL(item.operation==='convert'?'./convert-worker.js':'./compress-worker.js',import.meta.url),{type:'module'}); }
  catch {item.status='error';item.error='This browser cannot start the compressor. Try a current browser.';render();processNext();return;}
  current={item,worker,timer:null};
  const finish=result=>{
    if(current?.worker!==worker)return;
    clearTimeout(current.timer);worker.terminate();current=null;
    if(result.ok){
      item.status='done';item.blob=new Blob([result.buffer],{type:'image/png'});item.url=URL.createObjectURL(item.blob);
      item.preview=URL.createObjectURL(item.operation==='convert'?item.blob:item.file);item.primaryOnly=result.primaryOnly;item.optimizationSkipped=result.optimizationSkipped;item.convertedBytes=result.convertedBytes;item.width=result.width;item.height=result.height;
      item.outputName=item.operation==='convert'?item.file.name.replace(/\.[^.]+$/,'')+'.png':item.file.name.replace(/\.png$/i,'')+'-compressed.png';
    }else{item.status='error';item.error=result.error||'Compression failed. Please remove the file and try again.';}
    render();processNext();
  };
  worker.onmessage=event=>{
    if(event.data.phase==='compressing'){item.phase='compressing';render();return;}
    finish(event.data);
  };
  worker.onerror=()=>finish({ok:false,error:'The compressor could not read this file. Your original is unchanged.'});
  current.timer=setTimeout(()=>finish({ok:false,error:'This image took too long to process. Try a smaller image.'}),120000);
  render();
  try {const buffer=await item.file.arrayBuffer();if(current?.worker===worker)worker.postMessage({buffer},[buffer]);}
  catch {finish({ok:false,error:'This file could not be read. Please select it again.'});}
}
function make(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function createRow(item) {
  const row=make('li','file'), thumb=make('div','thumb'), info=make('div','file-info');
  thumb.setAttribute('aria-hidden','true');
  const name=make('div','file-name',item.file.name), detail=make('div','file-detail'), saving=make('span','saving');
  saving.hidden=true;name.title=item.file.name;info.append(name,detail,saving);
  const actions=make('div','file-actions'), control=make('span','file-control'), remove=make('button','icon-button remove');
  remove.innerHTML=icons.remove;remove.title=`Remove ${item.file.name}`;remove.setAttribute('aria-label',remove.title);
  remove.addEventListener('click',()=>removeItem(item.id));actions.append(control,remove);
  row.append(thumb,info,actions);list.append(row);
  return {row,thumb,detail,saving,control,remove,status:null};
}
function extraPngSaved(item) {
  return item.operation==='convert'&&!item.optimizationSkipped&&Number.isFinite(item.convertedBytes)?Math.max(0,item.convertedBytes-item.blob.size):0;
}
function updateRow(view,item) {
  const state=`${item.status}:${item.phase||''}`;
  if(view.status===state)return;
  view.status=state;view.row.className=`file ${item.status}`;
  view.detail.textContent=item.status==='queued'?'Waiting':item.status==='working'?(item.operation==='convert'?(item.phase==='compressing'?'Compressing PNG…':'Converting…'):'Compressing…'):item.status==='error'?item.error:`${bytes(item.file.size)} → ${bytes(item.blob.size)}${item.primaryOnly?' · Primary photo':''}${item.optimizationSkipped?' · Compression unavailable':''}`;
  if(item.status==='done') {
    const source=make('span','source-size',bytes(item.file.size));
    const arrow=make('span','size-arrow','→');arrow.setAttribute('aria-label','to');
    const output=make('span','output-size',bytes(item.blob.size));
    view.detail.replaceChildren(source,document.createTextNode(' '),arrow,document.createTextNode(' '),output);
    if(item.primaryOnly)view.detail.append(make('span','file-note',' · Primary photo'));
    if(item.optimizationSkipped)view.detail.append(make('span','file-note',' · Compression unavailable'));
  }
  // Keep the remove control in place, including its keyboard focus.
  view.control.replaceChildren();
  if(item.status==='done'){
    const percent=(1-item.blob.size/item.file.size)*100;
    view.saving.className=`saving${percent<=0?' neutral':''}`;
    const extraSaved=extraPngSaved(item);
    if(extraSaved>0)view.saving.className='saving extra-saving';
    view.saving.title=extraSaved>0?`PNG before compression: ${bytes(item.convertedBytes)} → ${bytes(item.blob.size)}`:'';
    view.saving.textContent=item.operation==='convert'?(extraSaved>0?`${bytes(extraSaved)} saved after conversion`:'PNG ready'):percent>0?`−${Math.min(percent,99.9).toFixed(1)}%`:percent<0?`+${Math.abs(percent).toFixed(1)}%`:'Optimized';
    view.saving.hidden=false;
    const link=make('a','icon-button');link.href=item.url;link.download=item.outputName;link.innerHTML=icons.download;link.title=`Download ${item.outputName}`;link.setAttribute('aria-label',link.title);
    view.control.append(link);
    const img=make('img','thumb');img.alt='';
    img.addEventListener('load',()=>{
      if(!view.row.isConnected)return;
      view.thumb.replaceWith(img);view.thumb=img;
      if(visibleRow(view.row))motion(img,[
        {opacity:0,transform:'translateY(-.4rem) rotate(-3deg) scale(.94)'},
        {opacity:1,transform:'translateY(.03rem) rotate(.4deg) scale(1.015)',offset:.72},
        {opacity:1,transform:'none'}
      ],{duration:300});
    },{once:true});
    img.src=item.preview;
  }else if(item.status==='working'){
    const spinner=make('span','spinner');spinner.setAttribute('aria-label','Processing');view.control.append(spinner);
  }
}
function render(){
  const modeChanged=results.hidden!==!items.length;
  if(modeChanged)stopMotion();
  const focused=document.activeElement;
  results.hidden=!items.length;
  emptyState.hidden=!!items.length;
  document.body.classList.toggle('has-images',!!items.length);
  $('#count').textContent=String(items.length);
  const done=items.filter(i=>i.status==='done'),pending=items.filter(i=>i.status==='working'||i.status==='queued');
  results.dataset.state=pending.length?'processing':done.length?'ready':'error';
  const allCompressed=done.every(i=>i.operation==='compress');
  const allConverted=done.every(i=>i.operation==='convert');
  const saved=done.reduce((sum,item)=>sum+(item.operation==='convert'?extraPngSaved(item):Math.max(0,item.file.size-item.blob.size)),0);
  $('#summary').textContent=pending.length?`Processing ${pending.length} ${pending.length===1?'image':'images'}…`:done.length?`${done.length} ${done.length===1?'image':'images'} ready`:'Your original files are unchanged.';
  const totalLabel=allCompressed?'saved':allConverted?'saved after conversion':'saved by PNG compression';
  const batchSaving=$('#batch-saving');
  batchSaving.hidden=!!pending.length||done.length<2||saved<=0;
  batchSaving.textContent=saved>0?`↘ ${bytes(saved)} ${totalLabel}`:'';
  const ids=new Set(items.map(item=>item.id)), arrivals=[];
  for(const [id,view] of rows){if(!ids.has(id)){view.row.remove();rows.delete(id);}}
  for(const item of items){
    let view=rows.get(item.id);
    if(!view){view=createRow(item);rows.set(item.id,view);arrivals.push(view.row);}
    updateRow(view,item);
  }
  $('#download-all').hidden=done.length<2;$('#download-count').textContent=`(${done.length})`;
  if(modeChanged)motion(items.length?results:emptyState,[{opacity:0},{opacity:1}],{duration:160});
  if(!modeChanged)for(const row of arrivals){if(visibleRow(row))motion(row,[{opacity:0,transform:'translateY(.45rem)'},{opacity:1,transform:'none'}],{duration:220});}
  if(focused&&(!focused.isConnected||(results.hidden&&results.contains(focused))||(emptyState.hidden&&emptyState.contains(focused)))){
    (results.hidden?$('#choose'):$('#add-more')).focus({preventScroll:true});
  }
}
$('#download-all').addEventListener('click',async()=>{
  const button=$('#download-all');button.disabled=true;
  try{
    const zip=new window.JSZip(),used=new Set();
    for(const item of items.filter(i=>i.status==='done')){
      let name=item.outputName,n=1;
      while(used.has(name))name=item.outputName.replace(/(\.[^.]+)$/,` (${++n})$1`);
      used.add(name);zip.file(name,item.blob);
    }
    const blob=await zip.generateAsync({type:'blob',compression:'STORE'}),url=URL.createObjectURL(blob);
    const a=make('a');a.href=url;a.download='pocketcompress.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch{notify('The ZIP could not be created. You can still download each image individually.');}
  finally{button.disabled=false;}
});
// The optional WebMCP tool reads the same results shown on the page.
const context=document.modelContext;
if(context?.registerTool){
  const lifetime=new AbortController();
  const register=tool=>{try{Promise.resolve(context.registerTool(tool,{signal:lifetime.signal})).catch(()=>{});}catch{}};
  register({name:'get_compression_results',title:'Read compression results',description:'Read the status and sizes of the images currently in this page. Does not upload or download files.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async input=>{if(!input||Object.keys(input).length)throw new Error('No arguments expected.');return {format:'png',images:items.map(i=>({name:i.file.name,status:i.status,originalBytes:i.file.size,outputBytes:i.blob?.size,error:i.error}))};}});
  window.addEventListener('pagehide',()=>lifetime.abort(),{once:true});
}
