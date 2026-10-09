import {SculptureRenderer, FINISHES} from './renderer.js';
import {SHAPES, PALETTES, parseView} from './geometry.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const descriptions = {
  knot: {name:'The beautiful loop.', text:'One continuous path. A thousand ways to look at it.'},
  bloom: {name:'A softer kind of geometry.', text:'Folded surfaces. Gentle curves. Something almost alive.'},
  orbit: {name:'Around, and around again.', text:'A familiar circle with an unexpected rhythm.'}
};
let renderer, toastTimer, immersiveReturn, booting=false;
const state = {...parseView(location.hash), paused:matchMedia('(prefers-reduced-motion: reduce)').matches, wireframe:false};

function notify(message) {
  const el=$('#toast'); el.textContent=message; el.classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3400);
}
function updateURL() {
  const params=new URLSearchParams({shape:state.shape,finish:state.palette});
  history.replaceState(null,'',`#${params}`);
}
function updateLabels() {
  $$('[data-shape]').forEach(el=>{const active=el.dataset.shape===state.shape;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));});
  $$('[data-palette]').forEach(el=>{const active=el.dataset.palette===state.palette;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));});
  $('#finish-name').textContent=FINISHES[state.palette].name;
  $('#object-name').textContent=descriptions[state.shape].name;$('#object-description').textContent=descriptions[state.shape].text;
  const index=String(SHAPES.indexOf(state.shape)+1).padStart(3,'0');
  $('#figure-index').textContent=`FIG. ${index}`;$('#object-number').textContent=index;
  $('#sculpture').setAttribute('aria-label',`Interactive ${state.shape} sculpture in ${FINISHES[state.palette].name}. Drag to rotate, pinch to zoom, or use arrow keys and plus or minus.`);
  $('#motion').setAttribute('aria-pressed',String(state.paused));$('#motion').setAttribute('aria-label',state.paused?'Resume rotation':'Pause rotation');
  $('#motion').title=state.paused?'Resume rotation':'Pause rotation';$('#motion use').setAttribute('href',state.paused?'#play':'#pause');
  $('#wireframe').setAttribute('aria-pressed',String(state.wireframe));$('#wireframe').setAttribute('aria-label',state.wireframe?'Hide wireframe':'Show wireframe');
}
function selectShape(shape) {state.shape=shape;renderer?.setShape(shape);updateLabels();updateURL();}
function selectPalette(palette) {state.palette=palette;renderer?.setPalette(palette);updateLabels();updateURL();}
const dependentButtons=()=>$$('#controls button, #save, #surprise, #immersive');
function fail(message) {
  $('#loading').hidden=true;$('#fallback').hidden=false;
  $('#fallback-message').textContent=message;dependentButtons().forEach(el=>el.disabled=true);
}
function boot() {
  if(booting)return;booting=true;
  try {
    renderer?.destroy();renderer=undefined;
    renderer=new SculptureRenderer($('#sculpture'),state);
    renderer.running=!state.paused;renderer.wireframe=state.wireframe;renderer.draw();
    $('#loading').hidden=true;$('#fallback').hidden=true;dependentButtons().forEach(el=>el.disabled=false);
    updateLabels();
  } catch(error) {
    console.error('FORM renderer:',error);
    fail('Your browser could not start 3D. Try enabling hardware acceleration or opening this page in Safari, Chrome, or Firefox.');
  } finally {booting=false;}
}

$$('[data-shape]').forEach(button=>button.addEventListener('click',()=>selectShape(button.dataset.shape)));
$$('[data-palette]').forEach(button=>button.addEventListener('click',()=>selectPalette(button.dataset.palette)));
$('#motion').addEventListener('click',()=>{state.paused=!state.paused;if(renderer)renderer.running=!state.paused;updateLabels();});
$('#wireframe').addEventListener('click',()=>{state.wireframe=!state.wireframe;if(renderer){renderer.wireframe=state.wireframe;renderer.draw();}updateLabels();});
$('#reset-view').addEventListener('click',()=>{renderer?.reset();notify('A fresh perspective.');});
$('#zoom-in').addEventListener('click',()=>renderer?.zoom(-.35));
$('#zoom-out').addEventListener('click',()=>renderer?.zoom(.35));
$('#retry').addEventListener('click',boot);
$('#surprise').addEventListener('click',()=>{
  const choices=SHAPES.filter(shape=>shape!==state.shape), colors=PALETTES.filter(palette=>palette!==state.palette);
  selectShape(choices[Math.floor(Math.random()*choices.length)]);selectPalette(colors[Math.floor(Math.random()*colors.length)]);
  renderer?.reset();notify('A new form. A new perspective.');
});

function toggleImmersive(force) {
  const active=force??!document.body.classList.contains('immersive');
  if(active) immersiveReturn=document.activeElement;
  document.body.classList.toggle('immersive',active);
  $('#immersive').setAttribute('aria-label',active?'Close immersive view':'Open immersive view');
  $('#immersive').title=active?'Close immersive view':'Immersive view';
  $('#immersive use').setAttribute('href',active?'#close':'#expand');
  // Leave only the sculpture reachable while the immersive overlay is open.
  ['.site-header','.hero-copy','#controls','.object-info','.closing-note','footer'].forEach(selector=>$(selector).inert=active);
  if(active)$('#sculpture').focus({preventScroll:true});else immersiveReturn?.focus({preventScroll:true});
  renderer?.resize();
}
$('#immersive').addEventListener('click',()=>toggleImmersive());
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&document.body.classList.contains('immersive')){e.preventDefault();toggleImmersive(false);}
  if(e.key==='Tab'&&document.body.classList.contains('immersive')){
    e.preventDefault(); (document.activeElement===$('#sculpture')?$('#immersive'):$('#sculpture')).focus();
  }
});
for(const [dialogId,closeId] of [['about-dialog','close-about'],['share-dialog','close-share']]) {
  const dialog=$(`#${dialogId}`);$(`#${closeId}`).addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
}
$$('.about-trigger').forEach(button=>button.addEventListener('click',()=>$('#about-dialog').showModal()));
$('#share').addEventListener('click',async()=>{
  updateURL();
  try {await navigator.clipboard.writeText(location.href);notify('Link copied. Share your shape and finish.');}
  catch {$('#share-url').value=location.href;$('#share-dialog').showModal();$('#share-url').focus();$('#share-url').select();}
});
$('#save').addEventListener('click',async()=>{
  if(!renderer)return;const button=$('#save');button.disabled=true;
  try {
    const blob=await renderer.snapshot();const url=URL.createObjectURL(blob);const link=document.createElement('a');
    link.href=url;link.download=`form-${state.shape}-${state.palette}.png`;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);notify('Your sculpture is ready to save.');
  }catch(error){console.error('FORM export:',error);notify('Could not save this image. Please try again.');}
  finally{button.disabled=false;}
});
window.addEventListener('hashchange',()=>{const view=parseView(location.hash);state.shape=view.shape;state.palette=view.palette;renderer?.setShape(state.shape);renderer?.setPalette(state.palette);updateLabels();});
$('#sculpture').addEventListener('webglcontextlost',e=>{e.preventDefault();if(renderer)renderer.running=false;fail('The 3D scene was interrupted. Tap Try again, or wait a moment for your browser to restore it.');});
$('#sculpture').addEventListener('webglcontextrestored',boot);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{state.paused=e.matches;if(renderer)renderer.running=!state.paused;updateLabels();});
updateLabels();boot();
