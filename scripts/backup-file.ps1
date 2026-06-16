<#
.SYNOPSIS
    Pre-edit backup: snapshots specified files before modification.
    Copies to _backups/pre-edit/ with timestamp and to redundant local disk.
.DESCRIPTION
    Run this BEFORE editing any file. It creates two backup copies:
    1. _backups/pre-edit/{filepath-with-timestamp} (inside project, gitignored)
    2. C:\Users\AmosA\Backups\animas-reflections-pwa\file-snapshots\ (redundant local)
.PARAMETER Files
    One or more file paths relative to project root.
.EXAMPLE
    .\scripts\backup-file.ps1 src/hooks/useCatalog.ts
.EXAMPLE
    .\scripts\backup-file.ps1 src/app/layout.tsx,src/app/page.tsx
#>
param(
    [Parameter(Mandatory=$true, ValueFromRemainingArguments=$true)]
    [string[]]$Files
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot | Split-Path -Parent
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RedundantRoot = "C:\Users\AmosA\Backups\animas-reflections-pwa\file-snapshots"
$PreEditDir = Join-Path $ProjectRoot "_backups\pre-edit"

if (-not (Test-Path $PreEditDir)) { New-Item -ItemType Directory -Path $PreEditDir -Force | Out-Null }
if (-not (Test-Path $RedundantRoot)) { New-Item -ItemType Directory -Path $RedundantRoot -Force | Out-Null }

$BackedUp = @()

foreach ($file in $Files) {
    $SourcePath = Join-Path $ProjectRoot $file

    if (-not (Test-Path $SourcePath)) {
        Write-Host "WARNING: File not found, skipping: $file" -ForegroundColor Yellow
        continue
    }

    $RelativePath = $file -replace '[\\/]', '-'
    $BackupName = "${Timestamp}__${RelativePath}"

    # Copy 1: _backups/pre-edit/
    $Dest1 = Join-Path $PreEditDir $BackupName
    Copy-Item -LiteralPath $SourcePath -Destination $Dest1 -Force

    # Copy 2: Redundant local disk
    $Dest2Dir = Join-Path $RedundantRoot (Split-Path $BackupName -Parent)
    if (-not (Test-Path $Dest2Dir)) { New-Item -ItemType Directory -Path $Dest2Dir -Force | Out-Null }
    $Dest2 = Join-Path $Dest2Dir (Split-Path $BackupName -Leaf)
    Copy-Item -LiteralPath $SourcePath -Destination $Dest2 -Force

    $BackedUp += $file
}

# Log the pre-edit backup event
$LogFile = Join-Path $ProjectRoot "_backups\backup-log.txt"
$LogEntry = "$Timestamp | PRE-EDIT | $($BackedUp -join ', ')"
Add-Content -LiteralPath $LogFile -Value $LogEntry

# Also log to redundant location
$RedundantLog = Join-Path $RedundantRoot "..\backup-log.txt"
Add-Content -LiteralPath $RedundantLog -Value $LogEntry

Write-Host "Backed up $($BackedUp.Count) file(s) at $Timestamp :" -ForegroundColor Green
$BackedUp | ForEach-Object { Write-Host "  $_" -ForegroundColor Cyan }
Write-Host "  -> _backups/pre-edit/" -ForegroundColor DarkGray
Write-Host "  -> $RedundantRoot" -ForegroundColor DarkGray
