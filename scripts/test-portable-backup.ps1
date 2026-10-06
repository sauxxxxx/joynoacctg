Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'portable-backup-crypto.ps1')
$directory = Join-Path ([IO.Path]::GetTempPath()) ('joyno-portable-test-' + [Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $directory)
$original = Join-Path $directory 'original.dump'
$encrypted = Join-Path $directory 'portable.backup'
$restored = Join-Path $directory 'restored.dump'
$rejectedOutput = Join-Path $directory 'rejected.dump'
$passphrase = ConvertTo-SecureString 'disposable-recovery-passphrase-123' -AsPlainText -Force
$wrong = ConvertTo-SecureString 'incorrect-recovery-passphrase-123' -AsPlainText -Force
try {
    $bytes = New-Object byte[] 2097213
    $random = [Security.Cryptography.RandomNumberGenerator]::Create(); $random.GetBytes($bytes); $random.Dispose()
    [IO.File]::WriteAllBytes($original, $bytes)
    Protect-PortableBackup $original $encrypted $passphrase
    Unprotect-PortableBackup $encrypted $restored $passphrase
    if ((Get-FileHash -LiteralPath $original).Hash -ne (Get-FileHash -LiteralPath $restored).Hash) { throw 'Portable round-trip mismatch.' }
    $rejected = $false
    try { Unprotect-PortableBackup $encrypted $rejectedOutput $wrong } catch { $rejected = $_.Exception.Message -like '*authentication failed*' }
    if (-not $rejected -or (Test-Path -LiteralPath $rejectedOutput)) { throw 'Wrong passphrase was not rejected before writing plaintext.' }
    $stream = [IO.File]::Open($encrypted, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite)
    try { $stream.Position = $stream.Length - 100; $value = $stream.ReadByte(); $stream.Position--; $stream.WriteByte($value -bxor 1) } finally { $stream.Dispose() }
    $rejected = $false
    try { Unprotect-PortableBackup $encrypted $rejectedOutput $passphrase } catch { $rejected = $_.Exception.Message -like '*authentication failed*' }
    if (-not $rejected -or (Test-Path -LiteralPath $rejectedOutput)) { throw 'Tampered archive was not rejected before writing plaintext.' }
    Write-Output 'Portable encryption round-trip, wrong-passphrase rejection and tamper rejection passed.'
} finally {
    $passphrase.Dispose(); $wrong.Dispose()
    foreach ($ownedFile in @($original, $encrypted, $restored, $rejectedOutput)) { if (Test-Path -LiteralPath $ownedFile) { Remove-Item -LiteralPath $ownedFile } }
    Remove-Item -LiteralPath $directory
}
