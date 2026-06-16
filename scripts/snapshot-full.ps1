<#
.SYNOPSIS
    Full project snapshot to redundant local disk.
.DESCRIPTION
    Copies the entire project (excluding node_modules, .next, out, _backups)
    to C:\Users\AmosA\Backups\animas-reflections-pwa\full-snapshots\ with timestamp.
    Use this for daily or milestone backups.
.PARAMETER Label
    Optional label for the snapshot (e.g., "pre-refactor", "before-deploy").
.EXAMPLE
    .\scripts\snapshot-full.ps1
.EXAMPLE
    .\scripts\snapshot-full.ps1 -Label "pre-square-migration"
#>
param(
    [string]$Label
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot | Split-Path -Parent
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$SnapshotName = if ($Label) { "${Timestamp}_$Label" } else { $Timestamp }
$RedundantRoot = "C:\Users\AmosA\Backups\animas-reflections-pwa\full-snapshots"
$DestDir = Join-Path $RedundantRoot $SnapshotName

$ExcludeDirs = @(
    "node_modules",
    ".next",
    "out",
    "_backups",
    "functions\node_modules",
    "functions\lib",
    ".git"
)

Write-Host "Creating full snapshot: $SnapshotName" -ForegroundColor Cyan
Write-Host "  Source: $ProjectRoot" -ForegroundColor DarkGray
Write-Host "  Dest  : $DestDir" -ForegroundColor DarkGray
Write-Host ""

# Build robocopy exclusion arguments
$RoboExclude = @()
foreach ($dir in $ExcludeDirs) {
    $RoboExclude += "/XD"
    $RoboExclude += $dir
}

# Use robocopy for fast, resumable copy with exclusions
$RoboArgs = @($ProjectRoot, $DestDir, "/E", "/R:2", "/W:2", "/NP", "/NFL", "/NDL") + $RoboExclude

$Result = & robocopy @RoboArgs

# robocopy exit codes 0-7 are success
if ($LASTEXITCODE -ge 8) {
    Write-Host "ERROR: Snapshot failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

# Log
$LogFile = Join-Path $ProjectRoot "_backups\backup-log.txt"
$LogEntry = "$Timestamp | SNAPSHOT | $SnapshotName | $(if($Label){$Label}else{'auto'})"
Add-Content -LiteralPath $LogFile -Value $LogEntry

$RedundantLog = "C:\Users\AmosA\Backups\animas-reflections-pwa\backup-log.txt"
Add-Content -LiteralPath $RedundantLog -Value $LogEntry

# List snapshot size
$SnapshotSize = (Get-ChildItem -LiteralPath $DestDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
$SizeMB = [math]::Round($SnapshotSize / 1MB, 2)

Write-Host "Snapshot complete: $SnapshotName ($SizeMB MB)" -ForegroundColor Green
Write-Host "  Location: $DestDir" -ForegroundColor Cyan

# List existing snapshots
$Existing = Get-ChildItem -LiteralPath $RedundantRoot -Directory | Sort-Object Name -Descending
Write-Host ""
Write-Host "Existing snapshots ($($Existing.Count)):" -ForegroundColor DarkGray
$Existing | Select-Object -First 10 | ForEach-Object { Write-Host "  $($_.Name)" -ForegroundColor DarkGray }
if ($Existing.Count -gt 10) { Write-Host "  ... and $($Existing.Count - 10) more" -ForegroundColor DarkGray }
