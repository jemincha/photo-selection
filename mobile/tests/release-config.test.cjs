const {test}=require('node:test');
const assert=require('node:assert/strict');
const configure=require('../app.config.js');
test('production cannot silently ship the local demo or an HTTP invitation origin',()=>{
 const names=['EAS_BUILD_PROFILE','EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_ANON_KEY','EXPO_PUBLIC_WEB_URL','IOS_BUNDLE_IDENTIFIER','EXPO_PUBLIC_OPERATOR_NAME','EXPO_PUBLIC_SUPPORT_EMAIL','EXPO_PUBLIC_PRIVACY_URL','EXPO_PUBLIC_SUPPORT_URL','EXPO_PUBLIC_TERMS_URL'];
 const before=Object.fromEntries(names.map(n=>[n,process.env[n]]));
 try{
  for(const n of names)delete process.env[n];
  assert.doesNotThrow(()=>configure({config:{ios:{supportsTablet:false}}}));
  process.env.EAS_BUILD_PROFILE='production';assert.throws(()=>configure({config:{}}),/missing/);
  Object.assign(process.env,{EXPO_PUBLIC_SUPABASE_URL:'https://project.supabase.co',EXPO_PUBLIC_SUPABASE_ANON_KEY:'test-public-key',EXPO_PUBLIC_WEB_URL:'http://localhost:8083',IOS_BUNDLE_IDENTIFIER:'test.seollek.app',EXPO_PUBLIC_OPERATOR_NAME:'테스트 운영자',EXPO_PUBLIC_SUPPORT_EMAIL:'support@seollek.com',EXPO_PUBLIC_PRIVACY_URL:'https://seollek.com/privacy',EXPO_PUBLIC_SUPPORT_URL:'https://seollek.com/support',EXPO_PUBLIC_TERMS_URL:'https://seollek.com/terms'});
  assert.throws(()=>configure({config:{}}),/HTTPS/);
  process.env.EXPO_PUBLIC_WEB_URL='https://seollek.example.test';assert.throws(()=>configure({config:{}}),/HTTPS URL/);
  process.env.EXPO_PUBLIC_WEB_URL='https://seollek.com';assert.equal(configure({config:{ios:{supportsTablet:false}}}).ios.bundleIdentifier,'test.seollek.app');
 }finally{for(const n of names){if(before[n]===undefined)delete process.env[n];else process.env[n]=before[n];}}
});
