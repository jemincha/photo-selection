# decode-uri-component 0.5.0 · CommonJS compatibility copy

Official source: https://github.com/SamVerschueren/decode-uri-component/tree/v0.5.0

Retrieved from the official npm package `decode-uri-component@0.5.0` on 2026-10-23. npm tarball SHA-1: `4592fa1e1d640ec5e2760e2e168ad2ab5f2c9da1`.

Upstream `index.js` SHA-256: `9401353df38f8010ad7035fe8d666bce6a4902bc1cff809afc4ab23fa2e0bdaa`. A regression test reconstructs the original export and verifies this digest.

The decoder algorithm is unchanged. The single `export default function` declaration becomes `module.exports = function` because Expo Router 57 consumes query-string 7, which calls this dependency synchronously through CommonJS. License and attribution are retained. The fixed upstream scanner replaces the exponential malformed-input fallback described in GHSA-vcc3-ghjq-m6fr.

This directory is selected by the root npm override and committed with the lockfile. Remove the override and this copy when the compatible Expo Router dependency tree uses the official patched decoder directly; run URL decoding regressions and web/iOS bundle checks afterward. Do not replace it with an unpatched 0.2.x package just to satisfy the old semver range.
