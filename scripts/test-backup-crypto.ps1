Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'windows-backup-crypto.ps1')
$testDirectory = Join-Path ([IO.Path]::GetTempPath()) ('joyno-backup-test-' + [Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $testDirectory)
$original = Join-Path $testDirectory 'original.dump'
$encrypted = Join-Path $testDirectory 'encrypted.joynobackup'
$restored = Join-Path $testDirectory 'restored.dump'
$tamperedResult = Join-Path $testDirectory 'tampered.dump'
try {
    $bytes = New-Object byte[] 2097213
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    $random.GetBytes($bytes)
    $random.Dispose()
    [IO.File]::WriteAllBytes($original, $bytes)
    Protect-JoynoBackup $original $encrypted
    Unprotect-JoynoBackup $encrypted $restored
    if ((Get-FileHash -LiteralPath $original).Hash -ne (Get-FileHash -LiteralPath $restored).Hash) { throw 'Round-trip mismatch.' }
    $stream = [IO.File]::Open($encrypted, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite)
    try {
        $stream.Position = $stream.Length - 100
        $value = $stream.ReadByte()
        $stream.Position--
        $stream.WriteByte($value -bxor 1)
    } finally { $stream.Dispose() }
    $rejected = $false
    try { Unprotect-JoynoBackup $encrypted $tamperedResult } catch { $rejected = $_.Exception.Message -like '*authentication failed*' }
    if (-not $rejected -or (Test-Path -LiteralPath $tamperedResult)) { throw 'Tampered backup was not rejected before output.' }
    Write-Output 'Backup encryption round-trip and tamper rejection passed.'
} finally {
    # Only the four explicitly named files created by this test are removed.
    foreach ($path in @($original, $encrypted, $restored, $tamperedResult)) {
        if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path }
    }
    Remove-Item -LiteralPath $testDirectory
}
