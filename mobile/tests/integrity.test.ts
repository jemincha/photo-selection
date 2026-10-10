import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sha256,sha256Blob} from '../src/integrity.ts';
test('LAN-compatible checksum matches standard SHA-256 for empty, text and binary files',async()=>{for(const bytes of [new Uint8Array(),new TextEncoder().encode('abc'),Uint8Array.from({length:4096},(_,i)=>i%256)]){assert.equal(await sha256(bytes.buffer as ArrayBuffer),createHash('sha256').update(bytes).digest('hex'));}});
test('chunked original verification preserves exact SHA-256 and lets UI timers run',async()=>{const bytes=Uint8Array.from({length:3*1024*1024+7},(_,i)=>i%251);let ticks=0;const timer=setInterval(()=>ticks++,0);try{assert.equal(await sha256Blob(new Blob([bytes])),createHash('sha256').update(bytes).digest('hex'));assert.ok(ticks>0);assert.equal(await sha256Blob(new Blob()),createHash('sha256').digest('hex'))}finally{clearInterval(timer)}});
