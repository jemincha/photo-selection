// Return File handles immediately. Do not decode every original with
// Promise.all just to discover dimensions before the upload queue exists.
export function pickWebFiles():Promise<File[]>{
 return new Promise((resolve,reject)=>{
  const input=document.createElement('input');input.type='file';input.accept='image/*';input.multiple=true;input.style.display='none';
  input.dataset.testid='upload-file-input';document.body.appendChild(input);
  const clean=()=>input.remove();
  input.addEventListener('change',()=>{const files=Array.from(input.files||[]);clean();resolve(files)},{once:true});
  input.addEventListener('cancel',()=>{clean();resolve([])},{once:true});
  try{input.click()}catch(error){clean();reject(error)}
 });
}
