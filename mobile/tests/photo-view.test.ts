import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boundZoom,initialZoom,PhotoPrefetch} from '../src/photo-view.ts';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

// Exercise the registered responder callbacks without pretending to render native views.
function viewer(){
 let handlers:any,zoom=initialZoom,state=0;const moves:number[]=[];
 const jsx=(type:unknown,props:unknown)=>({type,props});
 const react={useRef:(value:unknown)=>({current:value}),useState:(value:any)=>{const index=state++;return [typeof value==='function'?value():value,(next:any)=>{if(index===0)zoom=next;}]},useMemo:(fn:()=>unknown)=>fn(),useLayoutEffect:(fn:()=>void)=>fn()};
 const native={PanResponder:{create:(value:unknown)=>{handlers=value;return {panHandlers:{}};}},StyleSheet:{create:(value:unknown)=>value},Platform:{OS:'web'},Image:'Image',View:'View',Text:'Text',Pressable:'Pressable'};
 const exports:any={};
 const source=readFileSync(new URL('../src/zoom-photo.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
 runInNewContext(code,{exports,require:(name:string)=>{if(name==='react')return react;if(name==='react-native')return native;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};if(name==='./photo-view')return {boundZoom,initialZoom};throw new Error(name);}});
 const tree=exports.ZoomPhoto({uri:'preview',width:400,height:400,label:'사진',onMove:(delta:number)=>moves.push(delta)});
 tree.props.onLayout({nativeEvent:{layout:{width:300,height:400}}});
 const event=(points:number[][],timeStamp=1000)=>({timeStamp,nativeEvent:{touches:points.map(([pageX,pageY])=>({pageX,pageY})),pageX:100,pageY:100}});
 const start=(points:number[][])=>handlers.onPanResponderGrant(event(points));
 const move=(points:number[][])=>handlers.onPanResponderMove(event(points));
 const release=(dx=0,dy=0,time=1000)=>handlers.onPanResponderRelease(event([],time),{dx,dy});
 return {start,move,release,moves,zoom:()=>zoom,terminate:()=>handlers.onPanResponderTerminate()};
}

test('double tap toggles zoom; enlarged drags never navigate; a fresh base swipe navigates',()=>{
 const view=viewer();
 view.start([[100,100]]);view.release(0,0,1000);view.start([[100,100]]);view.release(0,0,1200);assert.equal(view.zoom().scale,2);
 view.start([[100,100]]);view.move([[200,100]]);view.release(100);assert.deepEqual(view.moves,[]);assert.equal(view.zoom().x,100);
 view.start([[100,100]]);view.release(0,0,2000);view.start([[100,100]]);view.release(0,0,2200);assert.equal(view.zoom().scale,1);
 view.start([[100,100]]);view.release(100);assert.deepEqual(view.moves,[1]);
 view.start([[100,100]]);view.release(-100);assert.deepEqual(view.moves,[1,-1]);
});

test('pinch clamps scale, tolerates a lifted finger, and cannot turn into navigation',()=>{
 const view=viewer();view.start([[100,100],[200,100]]);view.move([[0,100],[500,100]]);assert.equal(view.zoom().scale,4);
 view.move([[250,100]]);view.move([[270,100]]);view.release(170);assert.deepEqual(view.moves,[]);
 view.start([[100,100],[200,100]]);view.move([[100,100],[101,100]]);assert.equal(view.zoom().scale,1);view.release(-100);assert.deepEqual(view.moves,[]);
 view.start([[100,100]]);view.release(0,0,3000);view.terminate();view.start([[100,100]]);view.release(0,0,3100);assert.equal(view.zoom().scale,1);
});

test('zoom bounds contain portrait and landscape photos without panning into empty space',()=>{
 const viewport={width:300,height:400};
 assert.deepEqual(boundZoom({scale:2,x:999,y:-999},viewport,{width:400,height:200}),{scale:2,x:150,y:0});
 assert.deepEqual(boundZoom({scale:2,x:999,y:-999},viewport,{width:200,height:400}),{scale:2,x:50,y:-200});
 assert.deepEqual(boundZoom({scale:.5,x:500,y:500},viewport,{width:200,height:400}),initialZoom);
 assert.equal(boundZoom({scale:10,x:0,y:0},viewport,{width:400,height:200}).scale,4);
 assert.deepEqual(boundZoom({scale:2,x:1,y:1},{width:0,height:0},{width:0,height:0}),initialZoom);
});

test('rapid navigation replaces waiting previews, limits concurrency and retries failures',async()=>{
 const calls:string[]=[],releases:(()=>void)[]=[];let active=0,peak=0;
 const prefetch=new PhotoPrefetch(async uri=>{calls.push(uri);active++;peak=Math.max(peak,active);await new Promise<void>(resolve=>releases.push(resolve));active--;if(uri==='failed')throw new Error('network');});
 const settle=async()=>{releases.shift()!();await new Promise(resolve=>setImmediate(resolve));};
 prefetch.set(['a','b','ignored']);prefetch.set(['c','d']);await settle();assert.deepEqual(calls,['a','c']);
 await settle();assert.deepEqual(calls,['a','c','d']);await settle();assert.equal(peak,1);
 prefetch.set(['c','d']);assert.equal(calls.length,3);
 prefetch.set(['failed']);await settle();prefetch.set(['failed']);assert.equal(calls.at(-1),'failed');await settle();assert.equal(calls.filter(uri=>uri==='failed').length,2);
 prefetch.set(['e','f']);prefetch.set([]);await settle();assert.equal(calls.at(-1),'e');
});
