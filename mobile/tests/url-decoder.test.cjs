/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
test('vendored security fix keeps the verified upstream algorithm and MIT license',()=>{
 const file=path.join(__dirname,'../vendor/decode-uri-component/index.cjs');
 const source=fs.readFileSync(file,'utf8').split('\n').slice(2).join('\n').replace('module.exports = function decodeUriComponent(','export default function decodeUriComponent(');
 assert.equal(createHash('sha256').update(source).digest('hex'),'9401353df38f8010ad7035fe8d666bce6a4902bc1cff809afc4ab23fa2e0bdaa');
 assert.match(fs.readFileSync(path.join(__dirname,'../vendor/decode-uri-component/LICENSE'),'utf8'),/Sam Verschueren/);
});
test('installed Router query parser preserves Korean, emoji, repeated params and malformed bytes',()=>{
 const {parseQueryParams}=require('expo-router/build/fork/getStateFromPath-forks');
 const parse=query=>parseQueryParams(`/invite/test?${query}`,{name:'invite/[token]'});
 assert.equal(parse('name=%EC%84%A4%EB%A0%89&heart=%F0%9F%A4%8D').name,'설렉');
 assert.equal(parse('heart=%F0%9F%A4%8D').heart,'🤍');
 assert.deepEqual(parse('pick=a&pick=b').pick,['a','b']);
 assert.doesNotThrow(()=>parse('bad=%C2%41%EF%BF%BD%EF%BF%BD'));
});
test('malformed percent-encoded links finish within a bounded subprocess',()=>{
 const cwd=path.join(__dirname,'..');
 const result=spawnSync(process.execPath,['-e',"require('expo-router/build/fork/getStateFromPath-forks').parseQueryParams('/invite/test?bad='+'%C2%41'.repeat(10000),{name:'invite/[token]'})"],{cwd,timeout:5000,encoding:'utf8'});
 assert.ifError(result.error);assert.equal(result.status,0,result.stderr);
});
