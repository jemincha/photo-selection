import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const jsx=(type:unknown,props:any)=>({type,props});
function load(path:string,modules:Record<string,unknown>){
 const exports:any={},source=readFileSync(new URL(path,import.meta.url),'utf8');
 runInNewContext(ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:(name:string)=>{if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};if(name in modules)return modules[name];throw new Error(name);}});
 return exports;
}
function loading(reduced:boolean){
 const states:any[]=[],effects:any[]=[],values:any[]=[],timings:any[]=[];let cursor=0,effectIndex=0,complete=0,removed=false,stopped=false,callback:any;
 const motion={start:(fn:unknown)=>{callback=fn;},stop:()=>{stopped=true;callback?.({finished:false});}};
 class Value{value:number;constructor(value:number){this.value=value;values.push(this);}setValue(value:number){this.value=value;}interpolate(config:unknown):any{return {config,interpolate:this.interpolate};}}
 const react={useState:(initial:any)=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],(value:unknown)=>{states[i]=value;}];},useEffect:(fn:()=>unknown,deps:unknown[])=>{const i=effectIndex++,before=effects[i];if(!before||deps.some((value,index)=>!Object.is(value,before.deps[index]))){before?.cleanup?.();effects[i]={deps,pending:fn};}}};
 const native={View:'View',Text:'Text',StyleSheet:{create:(value:unknown)=>value},Platform:{OS:'web'},Easing:{linear:'linear'},Animated:{Value,View:'Animated.View',Text:'Animated.Text',timing:(_value:unknown,config:unknown)=>{timings.push(config);return motion;},stagger:()=>motion},AccessibilityInfo:{isReduceMotionEnabled:async()=>reduced,addEventListener:()=>({remove:()=>{removed=true;}})}};
 const {BrandLoading}=load('../src/brand-loading.tsx',{'react':react,'react-native':native});
 const onComplete=()=>{complete++;};
 const render=(ready:boolean)=>{cursor=0;effectIndex=0;const tree=BrandLoading({ready,onComplete});for(const effect of effects)if(effect.pending){const fn=effect.pending;delete effect.pending;effect.cleanup=fn();}return tree;};
 return {render,finish:()=>callback({finished:true}),unmount:()=>effects.forEach(effect=>effect.cleanup?.()),timings,values,completed:()=>complete,removed:()=>removed,stopped:()=>stopped};
}
test('brand bounce runs once, waits for initialization and cleans up on unmount',async()=>{
 const view=loading(false);view.render(false);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(view.timings.length,1);assert.ok(view.timings.every(item=>item.toValue===1&&item.duration===3400));
 view.finish();view.render(false);assert.equal(view.completed(),0);view.render(true);assert.equal(view.completed(),1);view.render(true);assert.equal(view.completed(),1);
 view.unmount();assert.ok(view.removed());assert.ok(view.stopped());
});
test('reduced motion settles the logo without a bounce or artificial loading delay',async()=>{
 const view=loading(true);view.render(true);await new Promise(resolve=>setImmediate(resolve));view.render(true);
 assert.equal(view.timings.length,0);assert.deepEqual(view.values.map(value=>value.value),[1]);assert.equal(view.completed(),1);view.unmount();
});
test('home has a single compact action and settings is the fourth tab',()=>{
 const store={userId:'me',name:'A',albums:[],requests:[],invitations:[],loading:false,error:''};
 const ui={Page:'Page',Button:'Button',PhotoImage:'PhotoImage',TaskState:'TaskState',styles:{},useTask:()=>({busy:false,error:''})};
 const home=load('../src/simple-home.tsx',{'react':{useState:(value:unknown)=>[value,()=>{}],useRef:(value:unknown)=>({current:value})},'./coachmarks':{Coachmarks:'Coachmarks'},'expo-router':{router:{}},'react-native':{Platform:{OS:'web'},Pressable:'Pressable',Text:'Text',View:'View'},'expo-image-picker':{},'./store':{useStore:()=>store},'./domain':{},'./event-domain':{},'./repository':{},'./pick-web-files':{},'./pending-photos':{},'./ui':ui}).default();
 assert.equal(home.props.subtitle,'함께한 설렘을 셀렉');assert.equal(home.props.fill,true);assert.equal(home.props.bottomInset,false);assert.equal(home.props.footer.props.children.type,'Button');assert.equal(home.props.footer.props.children.props.label,'+ 사진 올려 이벤트 만들기');
 const tabs=load('../src/app/(tabs)/_layout.tsx',{'expo-router':{Tabs:{Screen:'Tab'}},'react-native':{Text:'Text'},'../../store':{useStore:()=>store},'../../main-screens':{Onboarding:'Onboarding'}}).default();
 assert.deepEqual(Array.from(tabs.props.children,(tab:any)=>tab.props.options.title),['홈','친구','보관함','설정']);
});


test('first-use coachmarks advance then persist completion; returning users see no tutorial',async()=>{
 const data=new Map<string,string>(),states:any[]=[],effects:(()=>unknown)[]=[];let cursor=0,started=false;
 const storage={getItem:async(key:string)=>data.get(key)||null,setItem:async(key:string,value:string)=>{data.set(key,value);}};
 const react={useState:(initial:unknown)=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],(value:unknown)=>{states[i]=value;}];},useEffect:(fn:()=>unknown)=>{if(!started)effects.push(fn);}};
 const anchor={current:{measureInWindow:(fn:Function)=>fn(20,620,350,50)}};
 const {Coachmarks}=load('../src/coachmarks.tsx',{'react':react,'react-native':{Modal:'Modal',Pressable:'Pressable',ScrollView:'ScrollView',Text:'Text',View:'View',StyleSheet:{create:(value:unknown)=>value},useWindowDimensions:()=>({width:390,height:844})},'expo-router/js-tabs':{useBottomTabBarHeight:()=>84},'@react-native-async-storage/async-storage':storage,'./ui':{Button:'Button',TaskState:'TaskState',styles:{},useTask:()=>({run:async(fn:()=>Promise<void>)=>fn(),busy:false,error:''})}});
 const render=()=>{cursor=0;const tree=Coachmarks({anchor,userId:'me'});if(!started){started=true;effects.forEach(fn=>fn());}return tree;};
 const walk=(node:any):any[]=>Array.isArray(node)?node.flatMap(walk):node&&typeof node==='object'?[node,...walk(node.props?.children)]:[];
 assert.equal(render(),null);await new Promise(resolve=>setImmediate(resolve));
 let tree=render(),button=walk(tree).find(node=>node.type==='Button');assert.equal(button.props.label,'다음');
 button.props.onPress();tree=render();button=walk(tree).find(node=>node.type==='Button');assert.equal(button.props.label,'시작하기');assert.equal(data.size,0);
 button.props.onPress();await new Promise(resolve=>setImmediate(resolve));assert.equal(render(),null);assert.equal(data.get('seollek-coachmarks-v1:me'),'done');
 states.length=0;effects.length=0;started=false;assert.equal(render(),null);await new Promise(resolve=>setImmediate(resolve));assert.equal(render(),null);
});
