export type Zoom={scale:number;x:number;y:number};
export const initialZoom:Zoom={scale:1,x:0,y:0};
export function boundZoom(zoom:Zoom,viewport:{width:number;height:number},photo:{width:number;height:number}):Zoom{
 const scale=Math.max(1,Math.min(4,zoom.scale));
 const fit=Math.min(viewport.width/photo.width,viewport.height/photo.height);
 if(!Number.isFinite(fit)||fit<=0)return {...initialZoom};
 const x=Math.max(0,(photo.width*fit*scale-viewport.width)/2),y=Math.max(0,(photo.height*fit*scale-viewport.height)/2);
 return {scale,x:Math.max(-x,Math.min(x,zoom.x))||0,y:Math.max(-y,Math.min(y,zoom.y))||0};
}

// One in-flight preload; rapid navigation replaces the waiting pair.
export class PhotoPrefetch {
 private pending:string[]=[];
 private running=false;
 private seen=new Set<string>();
 private fetch:(uri:string)=>Promise<unknown>;
 constructor(fetch:(uri:string)=>Promise<unknown>){this.fetch=fetch;}
 set(uris:string[]){
  this.pending=[...new Set(uris.filter(Boolean))].slice(0,2);
  if(!this.running)void this.drain();
 }
 private async drain(){
  this.running=true;
  try{while(this.pending.length){const uri=this.pending.shift()!;if(this.seen.has(uri))continue;
   try{await this.fetch(uri);this.seen.add(uri);if(this.seen.size>8)this.seen.delete(this.seen.values().next().value!);}catch{/* Viewing retries failed speculative loads. */}
  }}finally{this.running=false;}
 }
}
