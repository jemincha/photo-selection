export function thumbnailSize(width:number,height:number,max=720){
 if(!width||!height)throw new Error('사진 크기를 읽지 못했어요.');
 const scale=Math.min(1,max/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

// Only the small destination canvas is allocated. Expo's web resize path
// creates full-resolution canvases and runs a pixel resampling loop in JS.
export async function createWebThumbnail(original:Blob){
 let source:ImageBitmap|HTMLImageElement|undefined,sourceUrl:string|undefined;
 const canvas=document.createElement('canvas');
 try{
  if(typeof createImageBitmap==='function'){try{source=await createImageBitmap(original)}catch{/* Safari may support HEIC through <img> only. */}}
  if(!source){sourceUrl=URL.createObjectURL(original);const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('사진 디코딩에 실패했어요.'));image.src=sourceUrl!});source=image;}
  const width='naturalWidth' in source?source.naturalWidth:source.width,height='naturalHeight' in source?source.naturalHeight:source.height;
  const size=thumbnailSize(width,height);canvas.width=size.width;canvas.height=size.height;
  const context=canvas.getContext('2d');if(!context)throw new Error('사진 미리보기 공간을 만들지 못했어요.');
  context.fillStyle='white';context.fillRect(0,0,size.width,size.height);context.drawImage(source,0,0,size.width,size.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('미리보기 변환에 실패했어요.')),'image/jpeg',.75));
  return {blob,width,height};
 }finally{
  if(source&&'close' in source)source.close();else if(source)source.src='';
  if(sourceUrl)URL.revokeObjectURL(sourceUrl);
  canvas.width=0;canvas.height=0;
 }
}
