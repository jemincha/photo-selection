const fs=require('node:fs');
const path=require('node:path');
const configure=require('../mobile/app.config.js');
const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'../release/review-evidence.json'),'utf8'));
const issues=[];
for(const check of evidence.checks)if(check.status!=='passed'||!check.evidence.trim())issues.push(`${check.id}: ${check.evidence}`);
const before=process.env.EAS_BUILD_PROFILE;
try{process.env.EAS_BUILD_PROFILE='production';configure({config:{}})}catch(error){issues.push(error.message)}finally{if(before===undefined)delete process.env.EAS_BUILD_PROFILE;else process.env.EAS_BUILD_PROFILE=before;}
for(const key of Object.keys(process.env))if(key.startsWith('EXPO_PUBLIC_')&&/(SERVICE_ROLE|SECRET|OPENAI_API_KEY|MAINTENANCE)/i.test(key))issues.push(`Server secret must not be public: ${key}`);
if(issues.length){console.error('출시 보류 — 제출 전 확인이 필요합니다.\n'+issues.map(v=>`- ${v}`).join('\n'));process.exitCode=1}else console.log('기록된 출시 조건 통과. 실제 제출·배포는 별도 작업입니다.');
