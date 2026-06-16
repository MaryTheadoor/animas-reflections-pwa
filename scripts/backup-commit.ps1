<#
.SYNOPSIS
    Post-edit backup: commits changes, pushes to GitHub, and snapshots to local disk.
.DESCRIPTION
    Run this AFTER making edits. It performs three redundant operations:
    1. git add + git commit (local repo backup)
    2. git push (GitHub remote backup)
    3. Copies changed files to C:\Users\AmosA\Backups\ (redundant local disk)
.PARAMETER Message
    Commit message describing the change.
.PARAMETER Files
    Optional: specific files to stage. If omitted, stages all changes.
.PARAMETER SkipPush
    Skip the GitHub push (for offline work).
.EXAMPLE
    .\scripts\backup-commit.ps1 -Message "fix: resolve hydration mismatch in header"
.EXAMPLE
    .\scripts\backup-commit.ps1 -Message "feat: add color picker" -Files src/app/customizer/page.tsx
.EXAMPLE
    .\scripts\backup-commit.ps1 -Message "wip: checkpoint" -SkipPush
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$Message,

    [string[]]$Files,

    [switch]$SkipPush
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot | Split-Path -Parent
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RedundantRoot = "C:\Users\AmosA\Backups\animas-reflections-pwa"
$CommitLogDir = Join-Path $RedundantRoot "commit-log"

if (-not (Test-Path $CommitLogDir)) { New-Item -ItemType Directory -Path $CommitLogDir -Force | Out-Null }

Set-Location -LiteralPath $ProjectRoot

# ── Step 1: Capture changed files BEFORE commit (for redundant copy) ──
$ChangedBefore = git diff --name-only HEAD 2>$null
$UntrackedBefore = git ls-files --others --exclude-standard 2>$null
$AllChanged = @($ChangedBefore) + @($UntrackedBefore) | Where-Object { $_ } | Sort-Object -Unique

# ── Step 2: Stage files ──
if ($Files) {
    foreach ($f in $Files) {
        git add $f
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Failed to stage $f" -ForegroundColor Red
            exit 1
        }
    }
    $AllChanged = $Files
} else {
    git add -A
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to stage files" -ForegroundColor Red
        exit 1
    }
}

# ── Step 3: Commit ──
git commit -m "$Timestamp : $Message" --allow-empty
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Commit failed" -ForegroundColor Red
    exit 1
}

$CommitHash = git rev-parse --short HEAD

# ── Step 4: Push to GitHub ──
if (-not $SkipPush) {
    git push
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: Push to GitHub failed (network?) - local commit saved" -ForegroundColor Yellow
    } else {
        Write-Host "Pushed to GitHub: $CommitHash" -ForegroundColor Green
    }
} else {
    Write-Host "Push skipped (--SkipPush)" -ForegroundColor Yellow
}

# ── Step 5: Redundant local disk backup of changed files ──
$SnapshotDir = Join-Path $RedundantRoot "file-snapshots" "${Timestamp}_$CommitHash"
New-Item -ItemType Directory -Path $SnapshotDir -Force | Out-Null

foreach ($file in $AllChanged) {
    $SourcePath = Join-Path $ProjectRoot $file
    if (Test-Path $SourcePath) {
        $DestPath = Join-Path $SnapshotDir ($file -replace '[\\/]', '-')
        $DestDir = Split-Path $DestPath -Parent
        if (-not (Test-Path $DestDir)) { New-Item -ItemType Directory -Path $DestDir -Force | Out-Null }
        Copy-Item -LiteralPath $SourcePath -Destination $DestPath -Force
    }
}

# ── Step 6: Log ──
$LogFile = Join-Path $ProjectRoot "_backups\backup-log.txt"
$LogEntry = "$Timestamp | COMMIT | $CommitHash | $Message | $($AllChanged -join ', ')"
Add-Content -LiteralPath $LogFile -Value $LogEntry

$RedundantLog = Join-Path $RedundantRoot "backup-log.txt"
Add-Content -LiteralPath $RedundantLog -Value $LogEntry

# ── Step 7: Save commit metadata to redundant log ──
$CommitInfo = @"
commit $CommitHash
Date: $Timestamp
Message: $Message
Files:
$($AllChanged | ForEach-Object { "  $_" } | Out-String)
"@
$CommitInfo | Out-File -LiteralPath (Join-Path $CommitLogDir "${Timestamp}_$CommitHash.txt") -Encoding utf8

Write-Host ""
Write-Host "=== BACKUP COMPLETE === $Timestamp ===" -ForegroundColor Green
Write-Host "  Commit : $CommitHash" -ForegroundColor Cyan
Write-Host "  Message: $Message" -ForegroundColor Cyan
Write-Host "  Files  : $($AllChanged.Count)" -ForegroundColor Cyan
if (-not $SkipPush) {
    Write-Host "  GitHub : pushed" -ForegroundColor Cyan
}
Write-Host "  Local  : $SnapshotDir" -ForegroundColor Cyan
