param([string]$BackupDirectory = 'D:\Joyno\Backups\joynoacctg', [string]$SourceArchive = '')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'portable-backup-crypto.ps1')
$directory = [IO.Path]::GetFullPath($BackupDirectory)
if (-not (Test-Path -LiteralPath $directory -PathType Container)) { throw 'The private backup directory is unavailable.' }
if (-not $SourceArchive) {
    $latest = Get-ChildItem -LiteralPath $directory -Filter 'joyno-*.dump.joynobackup' -File | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $latest) { throw 'No completed PC backup is available.' }
    $SourceArchive = $latest.FullName
}
$source = [IO.Path]::GetFullPath($SourceArchive)
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'The source archive is unavailable.' }
$destination = Join-Path $directory ([IO.Path]::GetFileName($source) + '.joynoportable')
if (Test-Path -LiteralPath $destination) { throw 'A recovery copy already exists for this backup; it was not overwritten.' }
$passphrase = Read-Host 'Choose a private recovery passphrase (16-128 characters; keep it separately)' -AsSecureString
$confirmation = Read-Host 'Confirm recovery passphrase' -AsSecureString
$first = [Net.NetworkCredential]::new('', $passphrase).Password
$second = [Net.NetworkCredential]::new('', $confirmation).Password
if ($first -cne $second) {
    $first = $null; $second = $null; $confirmation.Dispose(); $passphrase.Dispose()
    throw 'The recovery passphrases do not match.'
}
$first = $null; $second = $null; $confirmation.Dispose()
$plainFile = Join-Path $directory ([Guid]::NewGuid().ToString('N') + '.recovery-source')
$verifiedFile = Join-Path $directory ([Guid]::NewGuid().ToString('N') + '.recovery-check')
$partialFile = Join-Path $directory ([Guid]::NewGuid().ToString('N') + '.recovery-partial')
try {
    Unprotect-JoynoBackup $source $plainFile
    Protect-PortableBackup $plainFile $partialFile $passphrase
    Unprotect-PortableBackup $partialFile $verifiedFile $passphrase
    if ((Get-FileHash -LiteralPath $plainFile).Hash -ne (Get-FileHash -LiteralPath $verifiedFile).Hash) { throw 'Portable recovery verification failed.' }
    Move-Item -LiteralPath $partialFile -Destination $destination
    Write-Output "Portable recovery copy verified: $destination"
    Write-Output 'Keep this file and the recovery scripts on a separate device, and keep its passphrase separately. It does not need the original Windows profile.'
} finally {
    $passphrase.Dispose()
    foreach ($ownedFile in @($plainFile, $verifiedFile, $partialFile)) { if (Test-Path -LiteralPath $ownedFile) { Remove-Item -LiteralPath $ownedFile } }
}
