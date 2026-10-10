import {sha256 as hashBytes} from '@noble/hashes/sha2.js';
// LAN HTTP origins do not expose WebCrypto.subtle. Keep checksum verification
// available in Safari without disabling browser security or skipping hashing.
export async function sha256(bytes:ArrayBuffer){return Array.from(hashBytes(new Uint8Array(bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
// Read at most 1MB at a time and yield between chunks. Large originals must not
// block Safari's UI or keep another full-size ArrayBuffer alive during decoding.
export async function sha256Blob(blob:Blob){
 const hash=hashBytes.create();
 for(let offset=0;offset<blob.size;offset+=1024*1024){hash.update(new Uint8Array(await blob.slice(offset,offset+1024*1024).arrayBuffer()));await new Promise<void>(resolve=>setTimeout(resolve,0));}
 return Array.from(hash.digest(),b=>b.toString(16).padStart(2,'0')).join('');
}
