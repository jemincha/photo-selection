import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boundZoom,initialZoom,pinchZoom,PhotoPrefetch} from '../src/photo-view.ts';
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
 runInNewContext(code,{exports,require:(name:string)=>{if(name==='react')return react;if(name==='react-native')return native;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};if(name==='./native-zoom-photo')return {NativeZoomPhoto:'NativeZoomPhoto'};if(name==='./photo-view')return {boundZoom,initialZoom,pinchZoom};throw new Error(name);}});
 const component=exports.ZoomPhoto({uri:'preview',width:400,height:400,label:'사진',onMove:(delta:number)=>moves.push(delta)});const tree=component.type(component.props);
 tree.props.onLayout({nativeEvent:{layout:{width:300,height:400}}});
 const event=(points:number[][],timeStamp=1000)=>({timeStamp,nativeEvent:{touches:points.map(([pageX,pageY])=>({pageX,pageY})),pageX:100,pageY:100}});
 const start=(points:number[][])=>handlers.onPanResponderGrant(event(points));
 const move=(points:number[][])=>handlers.onPanResponderMove(event(points));
 const release=(dx=0,dy=0,time=1000)=>handlers.onPanResponderRelease(event([],time),{dx,dy});
 return {start,move,release,moves,zoom:()=>zoom,terminate:()=>handlers.onPanResponderTerminate()};
}

test('pinch zooms continuously and double tap resets; enlarged drags never navigate; a fresh base swipe navigates',()=>{
 const view=viewer();
 view.start([[100,100],[200,100]]);view.move([[31.5,100],[268.5,100]]);view.release();assert.equal(view.zoom().scale,2.37);
 view.start([[100,100]]);view.move([[200,100]]);view.release(100);assert.deepEqual(view.moves,[]);assert.equal(view.zoom().x,100);
 view.start([[100,100]]);view.release(0,0,2000);view.start([[100,100]]);view.release(0,0,2200);assert.equal(view.zoom().scale,1);
 view.start([[100,100]]);view.release(100);assert.deepEqual(view.moves,[1]);
 view.start([[100,100]]);view.release(-100);assert.deepEqual(view.moves,[1,-1]);
});

test('pinch clamps scale, tolerates a lifted finger, and cannot turn into navigation',()=>{
 const view=viewer();view.start([[100,100],[200,100]]);view.move([[0,100],[1000,100]]);assert.equal(view.zoom().scale,8);
 view.move([[250,100]]);view.move([[270,100]]);view.release(170);assert.deepEqual(view.moves,[]);
 view.start([[100,100],[200,100]]);view.move([[100,100],[101,100]]);assert.equal(view.zoom().scale,1);view.release(-100);assert.deepEqual(view.moves,[]);
 view.start([[100,100]]);view.release(0,0,3000);view.terminate();view.start([[100,100]]);view.release(0,0,3100);assert.equal(view.zoom().scale,1);
});

test('zoom bounds contain portrait and landscape photos without panning into empty space',()=>{
 const viewport={width:300,height:400};
 assert.deepEqual(boundZoom({scale:2,x:999,y:-999},viewport,{width:400,height:200}),{scale:2,x:150,y:0});
 assert.deepEqual(boundZoom({scale:2,x:999,y:-999},viewport,{width:200,height:400}),{scale:2,x:50,y:-200});
 assert.deepEqual(boundZoom({scale:.5,x:500,y:500},viewport,{width:200,height:400}),initialZoom);
 assert.equal(boundZoom({scale:10,x:0,y:0},viewport,{width:400,height:200}).scale,8);
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


test('pinch preserves the point under the fingers while allowing a moving midpoint',()=>{
 const zoom=pinchZoom(initialZoom,2.37,{x:120,y:90},{x:130,y:100},{x:150,y:200});assert.equal(zoom.scale,2.37);assert.ok(Math.abs(zoom.x-51.1)<1e-9);assert.ok(Math.abs(zoom.y-160.7)<1e-9);
 assert.equal(pinchZoom(initialZoom,20,{x:0,y:0},{x:0,y:0},{x:0,y:0}).scale,8);
});


test('iPhone viewer uses native pinch zoom and navigates only single-finger swipes at base scale',()=>{
 const refs:any[]=[],jsx=(type:unknown,props:any)=>({type,props}),moves:number[]=[];
 const react={useRef:(value:unknown)=>{const ref={current:value};refs.push(ref);return ref;},useState:(value:unknown)=>[value,()=>{}]};
 const exports:any={},source=readFileSync(new URL('../src/native-zoom-photo.tsx',import.meta.url),'utf8');
 runInNewContext(ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:(name:string)=>{if(name==='react')return react;if(name==='react-native')return {Image:'Image',Pressable:'Pressable',ScrollView:'ScrollView',Text:'Text',View:'View',StyleSheet:{create:(value:unknown)=>value}};if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};throw new Error(name);}});
 const tree=exports.NativeZoomPhoto({uri:'preview',label:'사진',onMove:(delta:number)=>moves.push(delta)}),scroll=tree.props.children[0].props;
 assert.equal(scroll.minimumZoomScale,1);assert.equal(scroll.maximumZoomScale,8);assert.equal(scroll.pinchGestureEnabled,true);
 const touch=(points:number[][],changed:number[][]=[])=>({nativeEvent:{touches:points.map(([pageX,pageY])=>({pageX,pageY})),changedTouches:changed.map(([pageX,pageY])=>({pageX,pageY}))}});
 scroll.onTouchStart(touch([[100,100]]));scroll.onTouchEnd(touch([],[[200,100]]));assert.deepEqual(moves,[1]);
 scroll.onTouchStart(touch([[100,100]]));scroll.onTouchEnd(touch([],[[0,100]]));assert.deepEqual(moves,[1,-1]);
 scroll.onTouchStart(touch([[100,100]]));scroll.onTouchMove(touch([[100,100],[200,100]]));scroll.onScroll({nativeEvent:{zoomScale:2.37}});scroll.onTouchEnd(touch([],[[250,100]]));assert.deepEqual(moves,[1,-1]);
 scroll.onTouchStart(touch([[100,100]]));scroll.onTouchEnd(touch([],[[200,100]]));assert.deepEqual(moves,[1,-1]);
 scroll.onScroll({nativeEvent:{zoomScale:1}});scroll.onTouchStart(touch([[100,100]]));scroll.onScrollEndDrag({nativeEvent:{contentOffset:{x:-100,y:0}}});scroll.onTouchEnd(touch([],[[200,100]]));assert.deepEqual(moves,[1,-1,1]);
});
