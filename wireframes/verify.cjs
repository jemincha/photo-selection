const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const handlers={};const store=new Map();
const body={dataset:{screen:'S5'},innerHTML:''};
const context=vm.createContext({document:{body,addEventListener:(name,fn,capture)=>{(handlers[name]??=[]).push({fn,capture})},querySelector:()=>null},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},location:{href:''},setTimeout:()=>{},FormData:class{constructor(form){this.data=form.values}get(k){return this.data[k]}}});
vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),context);
const run=code=>vm.runInContext(code,context);
const click=(action,id)=>{let stopped=false;const e={target:{closest:()=>({dataset:{action,id},disabled:false})},stopImmediatePropagation:()=>stopped=true};for(const h of [...handlers.click].sort((a,b)=>Number(!!b.capture)-Number(!!a.capture))){if(stopped)break;h.fn(e)}};
let count=0;
for(const id of ['S0','S1','S2','S3','S4','S5','S6','S7','S8','W1']){
 assert(fs.existsSync(__dirname+'/'+id+'.html'));
 run(`screen='${id}';model.role='owner';`);
 for(const role of ['owner','friend']){
  run(`model.role='${role}';`);
  for(const state of run(`supported[screen]`)){run(`state='${state}';render()`);assert(body.innerHTML.includes('class="phone"'));count++}
 }
}
run("screen='S5';state='default';model.role='friend';model.confirmed=false;render()");
assert(!body.innerHTML.includes('data-action="selection"'));
assert(!body.innerHTML.includes('data-action="add"'));
click('like','2');assert(run('model.likes.includes(2)'));
run("model.confirmed=true;render()");
const before=run('JSON.stringify(model.likes)');click('like','2');assert.equal(run('JSON.stringify(model.likes)'),before);
run("screen='S7';model.role='friend';render()");assert(!body.innerHTML.includes('data-action="confirm"'));
run("screen='S8';model.role='friend';render()");assert(!body.innerHTML.includes('data-action="store"'));
run("screen='S7';model.role='owner';model.confirmed=false;model.selected=[1,3];");click('do-confirm');assert(run('model.confirmed'));assert.equal(context.location.href,'S8.html');
run("screen='S5';model.role='friend';state='default';render()");assert(body.innerHTML.includes('변경할 수 없어요'));
run("model.confirmed=false;screen='S6';state='default';model.likes=[];model.dislikes=[];");
click('choose-dislike','4');assert(run('model.dislikes.includes(4)'));assert(!run('model.likes.includes(4)'));
click('choose-like','4');assert(run('model.likes.includes(4)'));assert(!run('model.dislikes.includes(4)'));
click('undo-choice');assert(run('model.dislikes.includes(4)'));assert(!run('model.likes.includes(4)'));
run("model.confirmed=true;");click('choose-like','4');assert(run('model.dislikes.includes(4)'));
run("model.confirmed=false;screen='S5';");click('request-mine');run('model.likes=[7];save()');click('request-friend');assert.equal(run('model.role'),'friend');assert(!run('model.likes.includes(7)'));run('model.likes=[8];save()');click('request-mine');assert.equal(run('model.role'),'owner');assert(run('model.likes.includes(7)'));assert(!run('model.likes.includes(8)'));
run("screen='S6';state='default';model.photo=5;render()");assert(!body.innerHTML.includes('data-action="prev"'));assert(body.innerHTML.includes('data-swipe="5"'));assert(!body.innerHTML.includes('data-swipe="6"'));
run('model.confirmed=false;model.likes=[];model.dislikes=[];model.unsure=[];');
click('choose-unsure','5');assert(run('model.unsure.includes(5)'));assert(!run('model.likes.includes(5)'));assert(!run('model.dislikes.includes(5)'));
click('choose-like','5');assert(!run('model.unsure.includes(5)'));click('undo-choice');assert(run('model.unsure.includes(5)'));
const classifications=run('JSON.stringify([model.likes,model.dislikes,model.unsure])');
const hint={textContent:''};const swipe={dataset:{swipe:'5'},style:{},classList:{add(){},remove(){}},querySelector:()=>hint,setPointerCapture(){}};
const pointer=(type,x,y)=>{const e={target:{closest:()=>swipe},pointerId:1,isPrimary:true,pointerType:'touch',clientX:x,clientY:y};for(const h of handlers[type]||[])h.fn(e)};
pointer('pointerdown',0,0);pointer('pointermove',5,100);pointer('pointerup',5,100);assert.equal(run('model.photo'),5);
pointer('pointerdown',0,0);pointer('pointermove',35,0);pointer('pointerup',35,0);assert.equal(run('model.photo'),5);
pointer('pointerdown',0,0);pointer('pointermove',100,5);pointer('pointerup',100,5);assert.equal(run('model.photo'),4);
pointer('pointerdown',0,0);pointer('pointermove',-100,5);pointer('pointercancel',-100,5);assert.equal(run('model.photo'),4);
pointer('pointerdown',0,0);pointer('pointermove',-100,5);pointer('pointerup',-100,5);assert.equal(run('model.photo'),5);
assert.equal(run('JSON.stringify([model.likes,model.dislikes,model.unsure])'),classifications);
run('model.confirmed=true;');pointer('pointerdown',0,0);pointer('pointermove',-100,5);pointer('pointerup',-100,5);assert.equal(run('model.photo'),6);click('choose-dislike','5');assert(run('model.unsure.includes(5)'));
run('model.photo=9;');pointer('pointerdown',0,0);pointer('pointermove',-100,5);pointer('pointerup',-100,5);assert.equal(run('model.photo'),9);
console.log(`PASS: ${count} screen/role/state renders; permissions; mutual-exclusive choices; undo; confirmation lock; independent requests and automatic roles.`);
