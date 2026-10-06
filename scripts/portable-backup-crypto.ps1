# Portable AES-256-CBC encrypt-then-HMAC-SHA256 archive, independent of Windows DPAPI.
# PBKDF2-HMAC-SHA256, 600,000 iterations; random salt and IV for every archive.
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'windows-backup-crypto.ps1')

function Get-PortableBackupKeys([Security.SecureString]$Passphrase, [byte[]]$Salt) {
    $plain = [Net.NetworkCredential]::new('', $Passphrase).Password
    if ($plain.Length -lt 16 -or $plain.Length -gt 128) { throw 'Use a recovery passphrase of 16-128 characters.' }
    $derive = [Security.Cryptography.Rfc2898DeriveBytes]::new($plain, $Salt, 600000, [Security.Cryptography.HashAlgorithmName]::SHA256)
    try { return ,$derive.GetBytes(64) } finally { $derive.Dispose(); $plain = $null }
}

function Protect-PortableBackup([string]$Source, [string]$Destination, [Security.SecureString]$Passphrase) {
    if (Test-Path -LiteralPath $Destination) { throw 'Portable destination already exists.' }
    $salt = New-Object byte[] 32
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    $random.GetBytes($salt); $random.Dispose()
    $keys = Get-PortableBackupKeys $Passphrase $salt
    $aes = [Security.Cryptography.Aes]::Create()
    $aes.Key = $keys[0..31]; $aes.GenerateIV()
    $outputStream = [IO.File]::Open($Destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $inputStream = $null; $crypto = $null
    try {
        $writer = New-Object IO.BinaryWriter($outputStream, [Text.Encoding]::UTF8, $true)
        $writer.Write([Text.Encoding]::ASCII.GetBytes("JOYNO-PORTABLE-V1`n"))
        $writer.Write([int]600000); $writer.Write($salt); $writer.Write($aes.IV)
        $writer.Flush(); $writer.Dispose()
        $inputStream = [IO.File]::OpenRead($Source)
        $crypto = New-Object Security.Cryptography.CryptoStream($outputStream, $aes.CreateEncryptor(), [Security.Cryptography.CryptoStreamMode]::Write, $true)
        $inputStream.CopyTo($crypto); $crypto.FlushFinalBlock()
    } finally {
        if ($crypto) { $crypto.Dispose() }; if ($inputStream) { $inputStream.Dispose() }
        $outputStream.Dispose(); $aes.Dispose()
    }
    try {
        $tag = Get-BackupAuthenticationTag $Destination $keys[32..63] (Get-Item -LiteralPath $Destination).Length
        $appendStream = [IO.File]::Open($Destination, [IO.FileMode]::Append, [IO.FileAccess]::Write)
        try { $appendStream.Write($tag, 0, $tag.Length) } finally { $appendStream.Dispose() }
    } finally { [Array]::Clear($keys, 0, $keys.Length) }
}

function Unprotect-PortableBackup([string]$Source, [string]$Destination, [Security.SecureString]$Passphrase) {
    if (Test-Path -LiteralPath $Destination) { throw 'Restore destination already exists.' }
    $inputStream = [IO.File]::OpenRead($Source)
    $aes = $null; $crypto = $null; $outputStream = $null; $keys = $null
    try {
        $reader = New-Object IO.BinaryReader($inputStream, [Text.Encoding]::UTF8, $true)
        if ([Text.Encoding]::ASCII.GetString($reader.ReadBytes(18)) -ne "JOYNO-PORTABLE-V1`n" -or $reader.ReadInt32() -ne 600000) { throw 'Unknown portable archive format.' }
        $salt = $reader.ReadBytes(32); $iv = $reader.ReadBytes(16)
        $cipherOffset = $inputStream.Position
        $cipherLength = $inputStream.Length - $cipherOffset - 32
        if ($salt.Length -ne 32 -or $iv.Length -ne 16 -or $cipherLength -le 0 -or $cipherLength % 16 -ne 0) { throw 'The portable archive is incomplete.' }
        $keys = Get-PortableBackupKeys $Passphrase $salt
        $inputStream.Position = $inputStream.Length - 32
        $received = $reader.ReadBytes(32)
        $tag = Get-BackupAuthenticationTag $Source $keys[32..63] ($inputStream.Length - 32)
        $difference = 0
        for ($index = 0; $index -lt 32; $index++) { $difference = $difference -bor ($received[$index] -bxor $tag[$index]) }
        if ($difference -ne 0) { throw 'Archive authentication failed. The passphrase is incorrect or the archive was changed.' }
        $inputStream.Position = $cipherOffset
        $aes = [Security.Cryptography.Aes]::Create(); $aes.Key = $keys[0..31]; $aes.IV = $iv
        $outputStream = [IO.File]::Open($Destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $crypto = New-Object Security.Cryptography.CryptoStream($outputStream, $aes.CreateDecryptor(), [Security.Cryptography.CryptoStreamMode]::Write, $true)
        $buffer = New-Object byte[] 1048576
        while ($cipherLength -gt 0) {
            $count = $inputStream.Read($buffer, 0, [int][Math]::Min($cipherLength, $buffer.Length))
            if ($count -eq 0) { throw 'The portable archive is incomplete.' }
            $crypto.Write($buffer, 0, $count); $cipherLength -= $count
        }
        $crypto.FlushFinalBlock()
    } finally {
        if ($crypto) { $crypto.Dispose() }; if ($outputStream) { $outputStream.Dispose() }
        if ($aes) { $aes.Dispose() }; if ($keys) { [Array]::Clear($keys, 0, $keys.Length) }
        $inputStream.Dispose()
    }
}
