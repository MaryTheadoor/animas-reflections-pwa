<#
.SYNOPSIS
    Restore files from backups.
.DESCRIPTION
    Restore files from pre-edit backups, commit snapshots, or full snapshots.
.PARAMETER Source
    Path to the backup file or directory to restore from.
.PARAMETER Target
    Optional: specific target path relative to project root.
    If omitted, restores to original location.
.PARAMETER List
    List available backup points.
.EXAMPLE
    .\scripts\restore.ps1 -List
.EXAMPLE
    .\scripts\restore.ps1 -Source _backups\pre-edit\20260616-180000__src-hooks-useCatalog.ts
#>
param(
    [string]$Source,
    [string]$Target,
    [switch]$List
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot | Split-Path -Parent

if ($List) {
    Write-Host "=== PRE-EDIT BACKUPS ===" -ForegroundColor Cyan
    $PreEditDir = Join-Path $ProjectRoot "_backups\pre-edit"
    if (Test-Path $PreEditDir) {
        Get-ChildItem -LiteralPath $PreEditDir | Sort-Object Name -Descending | ForEach-Object {
            Write-Host "  $($_.Name)" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  (none)" -ForegroundColor DarkGray
    }

    Write-Host ""
    Write-Host "=== FULL SNAPSHOTS ===" -ForegroundColor Cyan
    $SnapDir = "C:\Users\AmosA\Backups\animas-reflections-pwa\full-snapshots"
    if (Test-Path $SnapDir) {
        Get-ChildItem -LiteralPath $SnapDir -Directory | Sort-Object Name -Descending | ForEach-Object {
            Write-Host "  $($_.Name)" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  (none)" -ForegroundColor DarkGray
    }

    Write-Host ""
    Write-Host "=== GIT COMMITS ===" -ForegroundColor Cyan
    Set-Location -LiteralPath $ProjectRoot
    git log --oneline -20

    Write-Host ""
    Write-Host "=== REDUNDANT BACKUP LOCATION ===" -ForegroundColor Cyan
    Write-Host "  C:\Users\AmosA\Backups\animas-reflections-pwa\" -ForegroundColor DarkGray

    exit 0
}

if (-not $Source) {
    Write-Host "ERROR: Specify -Source or use -List to browse backups" -ForegroundColor Red
    exit 1
}

# Resolve source path (could be absolute, relative to project, or relative to redundant location)
$ResolvedSource = $null
$Candidates = @(
    $Source,
    (Join-Path $ProjectRoot $Source),
    (Join-Path "C:\Users\AmosA\Backups\animas-reflections-pwa" $Source)
)
foreach ($c in $Candidates) {
    if (Test-Path $c) {
        $ResolvedSource = $c
        break
    }
}

if (-not $ResolvedSource) {
    Write-Host "ERROR: Source not found: $Source" -ForegroundColor Red
    Write-Host "  Tried: $($Candidates -join ', ')" -ForegroundColor DarkGray
    exit 1
}

# Determine target
$ResolvedTarget = if ($Target) {
    Join-Path $ProjectRoot $Target
} else {
    # Try to extract original path from pre-edit backup name (format: timestamp__src-hooks-useCatalog.ts)
    $FileName = Split-Path $Source -Leaf
    if ($FileName -match '__') {
        $OriginalPath = ($FileName -split '__', 2)[1] -replace '-', '\'
        Join-Path $ProjectRoot $OriginalPath
    } else {
        Write-Host "WARNING: Cannot determine original path from '$FileName'. Use -Target to specify." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "Restoring:" -ForegroundColor Yellow
Write-Host "  From: $ResolvedSource" -ForegroundColor DarkGray
Write-Host "  To  : $ResolvedTarget" -ForegroundColor DarkGray

$Confirm = Read-Host "Proceed? [y/N]"
if ($Confirm -ne 'y' -and $Confirm -ne 'Y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

# Backup current file before overwriting
if (Test-Path $ResolvedTarget) {
    $Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $PreRestoreBackup = Join-Path $ProjectRoot "_backups\pre-restore" "$Timestamp-$(Split-Path $ResolvedTarget -Leaf)"
    $PreRestoreDir = Split-Path $PreRestoreBackup -Parent
    if (-not (Test-Path $PreRestoreDir)) { New-Item -ItemType Directory -Path $PreRestoreDir -Force | Out-Null }
    Copy-Item -LiteralPath $ResolvedTarget -Destination $PreRestoreBackup -Force
    Write-Host "  Current file backed up to: $PreRestoreBackup" -ForegroundColor DarkGray
}

Copy-Item -LiteralPath $ResolvedSource -Destination $ResolvedTarget -Force
Write-Host "Restored successfully." -ForegroundColor Green
