param([switch]$SkipWebExport)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
function Invoke-Check([string]$Directory,[string[]]$Arguments){
 Push-Location -LiteralPath (Join-Path $taskRoot $Directory)
 try{& npm @Arguments;if($LASTEXITCODE -ne 0){throw "Check failed: npm $Arguments"}}finally{Pop-Location}
}
Invoke-Check 'mobile' @('run','lint')
Invoke-Check 'mobile' @('run','typecheck')
Push-Location -LiteralPath (Join-Path $taskRoot 'mobile')
try{& './node_modules/.bin/tsc' --project ../supabase/functions/tsconfig.json;if($LASTEXITCODE -ne 0){throw 'Edge function typecheck failed'}}finally{Pop-Location}
Invoke-Check 'mobile' @('test')
Invoke-Check 'supabase/tests' @('test')
Invoke-Check 'supabase/tests' @('run','test:edge')
& node (Join-Path $taskRoot 'scripts/tests/release-tools.test.cjs')
if($LASTEXITCODE -ne 0){throw 'Release tool tests failed'}
if(-not $SkipWebExport){Invoke-Check 'mobile' @('run','export:web')}
Write-Output '로컬 검사 통과. 실제 서버·실기기·서명 및 심사 준비 확인은 scripts/release-check.cjs에서 별도로 추적합니다.'
