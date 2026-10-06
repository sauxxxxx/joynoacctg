param([Parameter(Mandatory)][string]$SourceArchive, [Parameter(Mandatory)][string]$DestinationDump)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'portable-backup-crypto.ps1')
$source = [IO.Path]::GetFullPath($SourceArchive)
$destination = [IO.Path]::GetFullPath($DestinationDump)
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'The portable archive is unavailable.' }
if (Test-Path -LiteralPath $destination) { throw 'Restore destination already exists; it was not overwritten.' }
if (-not (Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($destination)) -PathType Container)) { throw 'Create a private destination folder before restoring.' }
$passphrase = Read-Host 'Enter your private recovery passphrase' -AsSecureString
try {
    Unprotect-PortableBackup $source $destination $passphrase
    Write-Output "Authenticated archive decrypted: $destination"
    Write-Output 'This is a sensitive plaintext PostgreSQL dump. Restore into a disposable database first; this script does not change the live database.'
} finally { $passphrase.Dispose() }
