param(
    [string]$BackupDirectory = 'D:\Joyno\Backups\joynoacctg',
    [string]$IdentityFile = (Join-Path $env:USERPROFILE '.ssh\roarly_vps'),
    [switch]$VerifyRestore
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'windows-backup-crypto.ps1')

$directory = [IO.Path]::GetFullPath($BackupDirectory)
if (-not (Test-Path -LiteralPath $directory -PathType Container)) { throw 'Run the backup installer first.' }
if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) { throw 'The existing SSH identity is unavailable.' }
$sshArguments = @('-i', $IdentityFile, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=20')
$remote = 'root@187.53.140.168'
$lockStream = $null
$download = $null
$restored = $null
$temporaryEncrypted = $null
$stateFile = Join-Path $directory 'status.json'
try {
    $lockStream = [IO.File]::Open((Join-Path $directory 'backup.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $manifest = & ssh @sshArguments $remote 'sh /opt/joynoacctg/deploy/ubuntu/latest-backup.sh'
    if ($LASTEXITCODE -ne 0) { throw 'The server could not provide a completed backup.' }
    $match = [regex]::Match(($manifest -join "`n").Trim(), '^([a-f0-9]{64})  backups/(joyno-(\d{8}T\d{6}Z)-\d+\.dump)$')
    if (-not $match.Success) { throw 'The server backup manifest is invalid.' }
    $checksum = $match.Groups[1].Value
    $filename = $match.Groups[2].Value
    $backupTime = [DateTime]::ParseExact($match.Groups[3].Value, "yyyyMMdd'T'HHmmss'Z'", [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal).ToUniversalTime()
    if ([DateTime]::UtcNow.Subtract($backupTime).TotalHours -gt 36) { throw 'The server backup is older than 36 hours. Check the nightly backup service.' }
    $encrypted = Join-Path $directory ($filename + '.joynobackup')
    if (-not (Test-Path -LiteralPath $encrypted)) {
        if ((Get-PSDrive -Name ([IO.Path]::GetPathRoot($directory).Substring(0, 1))).Free -lt 2GB) { throw 'Less than 2 GB is available for backup copies.' }
        $download = Join-Path $directory ([Guid]::NewGuid().ToString('N') + '.download')
        & scp @sshArguments ($remote + ':/opt/joynoacctg/deploy/ubuntu/backups/' + $filename) $download
        if ($LASTEXITCODE -ne 0) { throw 'The backup download failed.' }
        if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash.ToLowerInvariant() -ne $checksum) { throw 'Downloaded backup checksum does not match the server.' }
        $temporaryEncrypted = Join-Path $directory ([Guid]::NewGuid().ToString('N') + '.encrypted')
        Protect-JoynoBackup $download $temporaryEncrypted
        $restored = Join-Path $directory ([Guid]::NewGuid().ToString('N') + '.verify')
        Unprotect-JoynoBackup $temporaryEncrypted $restored
        if ((Get-FileHash -LiteralPath $restored -Algorithm SHA256).Hash.ToLowerInvariant() -ne $checksum) { throw 'The encrypted backup failed its round-trip check.' }
        Move-Item -LiteralPath $temporaryEncrypted -Destination $encrypted
        $temporaryEncrypted = $null
    }
    if ($VerifyRestore) {
        if ($restored) { Remove-Item -LiteralPath $restored; $restored = $null }
        $restored = Join-Path $directory ([Guid]::NewGuid().ToString('N') + '.verify')
        Unprotect-JoynoBackup $encrypted $restored
        if ((Get-FileHash -LiteralPath $restored -Algorithm SHA256).Hash.ToLowerInvariant() -ne $checksum) { throw 'The stored backup checksum is invalid.' }
        # Return the decrypted PC copy to a uniquely named staging file, never the live database.
        $restoreName = 'pc-check-' + [Guid]::NewGuid().ToString('N') + '.dump'
        $remotePath = '/opt/joynoacctg/deploy/ubuntu/backups/' + $restoreName
        & scp @sshArguments $restored ($remote + ':' + $remotePath)
        if ($LASTEXITCODE -ne 0) { throw 'Could not stage the disposable restore check.' }
        & ssh @sshArguments $remote ("chmod 600 $remotePath; cd /opt/joynoacctg/deploy/ubuntu && sh restore-check.sh backups/$restoreName; result=`$?; rm -f -- $remotePath; exit `$result")
        if ($LASTEXITCODE -ne 0) { throw 'The PC backup failed its PostgreSQL restore check.' }
    }
    @{ success = $true; checkedAtUtc = [DateTime]::UtcNow.ToString('o'); backup = $filename; backupAtUtc = $backupTime.ToString('o'); restoreVerified = [bool]$VerifyRestore } | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
    Write-Output "Backup copy ready: $encrypted"
} catch {
    if ($lockStream) {
        @{ success = $false; checkedAtUtc = [DateTime]::UtcNow.ToString('o'); error = $_.Exception.Message } | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
    }
    throw
} finally {
    foreach ($ownedFile in @($download, $restored, $temporaryEncrypted)) {
        if ($ownedFile -and (Test-Path -LiteralPath $ownedFile)) { Remove-Item -LiteralPath $ownedFile }
    }
    if ($lockStream) { $lockStream.Dispose() }
}
