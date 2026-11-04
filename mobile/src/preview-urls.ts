export class PreviewUrls{
 private cached=new Map<string,{url:string;expires:number}>();
 private pending=new Map<string,Promise<string>>();
 private generation=0;
 private sign:(paths:string[])=>Promise<{path:string;url:string}[]>;
 private now:()=>number;
 constructor(sign:(paths:string[])=>Promise<{path:string;url:string}[]>,now:()=>number=Date.now){this.sign=sign;this.now=now;}
 clear(){this.generation++;this.cached.clear();this.pending.clear();}
 async get(paths:string[]){
  const missing=[...new Set(paths)].filter(path=>!this.pending.has(path)&&!((this.cached.get(path)?.expires||0)>this.now()));
  if(missing.length){
   const generation=this.generation,batch=this.sign(missing).then(rows=>{
    if(generation!==this.generation)throw new Error('사진 접근 상태가 변경됐어요.');
    for(const path of missing)if(!rows.some(row=>row.path===path&&row.url))throw new Error('미리보기 주소를 받지 못했어요. 다시 불러와주세요.');
    for(const row of rows)this.cached.set(row.path,{url:row.url,expires:this.now()+4*60*1000});
   });
   for(const path of missing){const pending=batch.then(()=>this.cached.get(path)!.url).finally(()=>{if(this.pending.get(path)===pending)this.pending.delete(path)});this.pending.set(path,pending);}
  }
  return Promise.all(paths.map(path=>this.pending.get(path)||Promise.resolve(this.cached.get(path)!.url)));
 }
}
