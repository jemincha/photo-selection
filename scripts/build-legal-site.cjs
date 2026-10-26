const fs=require('node:fs');
const path=require('node:path');
function renderLegalSite(settings,template){
const names=[...new Set([...template.matchAll(/\{\{(\w+)\}\}/g)].map(m=>m[1]))];
for(const name of names)if(typeof settings[name]!=='string'||!settings[name].trim())throw new Error(`Missing legal setting: ${name}`);
if(settings.legalReviewComplete!==true)throw new Error('Confirm the final policy matches the actual provider/backup/region settings before generating public pages.');
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email))throw new Error('Invalid public contact email');
const escape=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
return template.replace(/\{\{(\w+)\}\}/g,(_,name)=>escape(settings[name]));
}
module.exports={renderLegalSite};
if(require.main===module){
const root=path.join(__dirname,'..');
const settingsPath=path.join(root,'release/legal-settings.json');
if(!fs.existsSync(settingsPath))throw new Error('Fill release/legal-settings.json with real operational information first.');
const html=renderLegalSite(JSON.parse(fs.readFileSync(settingsPath,'utf8')),fs.readFileSync(path.join(root,'release/site-template.html'),'utf8'));
const output=path.join(root,'release/site');fs.mkdirSync(output,{recursive:true});
for(const name of ['index.html','privacy.html','terms.html','support.html'])fs.writeFileSync(path.join(output,name),html);
console.log('Generated local public pages in release/site. Nothing was published.');

}
