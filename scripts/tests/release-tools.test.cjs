const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {renderLegalSite}=require('../build-legal-site.cjs');
test('public policy generation refuses missing operations data or review; user values are escaped',()=>{
 const template=fs.readFileSync(path.join(__dirname,'../../release/site-template.html'),'utf8');
 const settings=JSON.parse(fs.readFileSync(path.join(__dirname,'../../release/legal-settings.example.json'),'utf8'));
 assert.throws(()=>renderLegalSite(settings,template),/Missing/);
 for(const key of Object.keys(settings))if(key!=='legalReviewComplete')settings[key]='시험용 값';
 settings.email='test@example.test';assert.throws(()=>renderLegalSite(settings,template),/Confirm/);
 settings.legalReviewComplete=true;settings.operator='<script>alert(1)</script>';
 const html=renderLegalSite(settings,template);assert.ok(!html.includes('{{'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});
test('release check stays closed while real server/device/operations evidence is pending',()=>{
 const result=spawnSync(process.execPath,[path.join(__dirname,'../release-check.cjs')],{encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/출시 보류/);assert.match(result.stderr,/iphone/);
});
