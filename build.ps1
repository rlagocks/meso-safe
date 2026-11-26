# source 폴더를 exe 한 파일(release\메소금고가계부.exe)로 만든다.
# 사용법: PowerShell에서  .\build.ps1
$ErrorActionPreference = 'Stop'
$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location (Join-Path $PSScriptRoot 'source')
if (-not (Test-Path node_modules)) { npm install --no-audit --no-fund }
npm run dist
Write-Host "완료: $(Join-Path $PSScriptRoot 'release\메소금고가계부.exe')"
