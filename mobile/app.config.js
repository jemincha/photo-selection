module.exports = ({ config }) => {
  const bundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER;
  if (process.env.EAS_BUILD_PROFILE === 'production') {
    const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_WEB_URL', 'IOS_BUNDLE_IDENTIFIER', 'EXPO_PUBLIC_OPERATOR_NAME', 'EXPO_PUBLIC_SUPPORT_EMAIL', 'EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_SUPPORT_URL', 'EXPO_PUBLIC_TERMS_URL'];
    const missing = required.filter(name => !process.env[name]);
    if (missing.length) throw new Error(`Production configuration missing: ${missing.join(', ')}`);
    if (!/^https:\/\//.test(process.env.EXPO_PUBLIC_WEB_URL)) throw new Error('Production web participation requires HTTPS.');
    for (const name of ['EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_WEB_URL','EXPO_PUBLIC_PRIVACY_URL','EXPO_PUBLIC_SUPPORT_URL','EXPO_PUBLIC_TERMS_URL']) {
      const url = new URL(process.env[name]);
      if(url.protocol!=='https:' || url.username || url.password || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url.hostname) || /\.(test|invalid|example)$/.test(url.hostname)) throw new Error(`Production HTTPS URL required: ${name}`);
    }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.EXPO_PUBLIC_SUPPORT_EMAIL)||/\.(test|invalid|example)$/.test(process.env.EXPO_PUBLIC_SUPPORT_EMAIL)) throw new Error('Real support email required.');
    if(!/^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z0-9-]+)+$/.test(bundleIdentifier)) throw new Error('Invalid iOS bundle identifier.');
  }
  return { ...config, ios: { ...config.ios, ...(bundleIdentifier ? { bundleIdentifier } : {}) } };
};
