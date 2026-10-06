# AES-256-CBC with encrypt-then-HMAC-SHA256. Each random key is protected by
# Windows DPAPI for the current Windows user. No password or database key is saved.
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Security

function Get-BackupAuthenticationTag([string]$Path, [byte[]]$Key, [long]$Length) {
    $hasher = New-Object System.Security.Cryptography.HMACSHA256(,$Key)
    $stream = [IO.File]::OpenRead($Path)
    try {
        $buffer = New-Object byte[] 1048576
        $remaining = $Length
        while ($remaining -gt 0) {
            $count = $stream.Read($buffer, 0, [int][Math]::Min($remaining, $buffer.Length))
            if ($count -eq 0) { throw 'The backup is incomplete.' }
            [void]$hasher.TransformBlock($buffer, 0, $count, $null, 0)
            $remaining -= $count
        }
        [void]$hasher.TransformFinalBlock([byte[]]@(), 0, 0)
        return ,$hasher.Hash
    } finally { $stream.Dispose(); $hasher.Dispose() }
}

function Protect-JoynoBackup([string]$Source, [string]$Destination) {
    if (Test-Path -LiteralPath $Destination) { throw 'Encrypted destination already exists.' }
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    $keys = New-Object byte[] 64
    $random.GetBytes($keys)
    $random.Dispose()
    $wrapped = [Security.Cryptography.ProtectedData]::Protect($keys, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $aes = [Security.Cryptography.Aes]::Create()
    $aes.Key = $keys[0..31]
    $aes.GenerateIV()
    $writerStream = [IO.File]::Open($Destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $readerStream = $null
    $crypto = $null
    try {
        $writer = New-Object IO.BinaryWriter($writerStream, [Text.Encoding]::UTF8, $true)
        $writer.Write([Text.Encoding]::ASCII.GetBytes("JOYNO-BACKUP-V1`n"))
        $writer.Write([int]$wrapped.Length)
        $writer.Write($wrapped)
        $writer.Write($aes.IV)
        $writer.Flush()
        $writer.Dispose()
        $readerStream = [IO.File]::OpenRead($Source)
        $crypto = New-Object Security.Cryptography.CryptoStream($writerStream, $aes.CreateEncryptor(), [Security.Cryptography.CryptoStreamMode]::Write, $true)
        $readerStream.CopyTo($crypto)
        $crypto.FlushFinalBlock()
    } finally {
        if ($readerStream) { $readerStream.Dispose() }
        if ($crypto) { $crypto.Dispose() }
        $writerStream.Dispose()
        $aes.Dispose()
    }
    $tag = Get-BackupAuthenticationTag $Destination $keys[32..63] (Get-Item -LiteralPath $Destination).Length
    $stream = [IO.File]::Open($Destination, [IO.FileMode]::Append, [IO.FileAccess]::Write)
    try { $stream.Write($tag, 0, $tag.Length) } finally { $stream.Dispose() }
    [Array]::Clear($keys, 0, $keys.Length)
}

function Unprotect-JoynoBackup([string]$Source, [string]$Destination) {
    if (Test-Path -LiteralPath $Destination) { throw 'Restore destination already exists.' }
    $stream = [IO.File]::OpenRead($Source)
    $aes = $null
    $crypto = $null
    $outputStream = $null
    try {
        $reader = New-Object IO.BinaryReader($stream, [Text.Encoding]::UTF8, $true)
        if ([Text.Encoding]::ASCII.GetString($reader.ReadBytes(16)) -ne "JOYNO-BACKUP-V1`n") { throw 'Unknown backup format.' }
        $keyLength = $reader.ReadInt32()
        if ($keyLength -lt 32 -or $keyLength -gt 16384) { throw 'Invalid protected backup key.' }
        $keys = [Security.Cryptography.ProtectedData]::Unprotect($reader.ReadBytes($keyLength), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        if ($keys.Length -ne 64) { throw 'Invalid backup key.' }
        $iv = $reader.ReadBytes(16)
        $cipherOffset = $stream.Position
        $cipherLength = $stream.Length - $cipherOffset - 32
        if ($iv.Length -ne 16 -or $cipherLength -le 0 -or $cipherLength % 16 -ne 0) { throw 'The backup is incomplete.' }
        $stream.Position = $stream.Length - 32
        $received = $reader.ReadBytes(32)
        $tag = Get-BackupAuthenticationTag $Source $keys[32..63] ($stream.Length - 32)
        $difference = 0
        for ($index = 0; $index -lt 32; $index++) { $difference = $difference -bor ($received[$index] -bxor $tag[$index]) }
        if ($difference -ne 0) { throw 'Backup authentication failed. Do not restore this file.' }
        $stream.Position = $cipherOffset
        $aes = [Security.Cryptography.Aes]::Create()
        $aes.Key = $keys[0..31]
        $aes.IV = $iv
        $outputStream = [IO.File]::Open($Destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $crypto = New-Object Security.Cryptography.CryptoStream($outputStream, $aes.CreateDecryptor(), [Security.Cryptography.CryptoStreamMode]::Write, $true)
        $buffer = New-Object byte[] 1048576
        while ($cipherLength -gt 0) {
            $count = $stream.Read($buffer, 0, [int][Math]::Min($cipherLength, $buffer.Length))
            if ($count -eq 0) { throw 'The backup is incomplete.' }
            $crypto.Write($buffer, 0, $count)
            $cipherLength -= $count
        }
        $crypto.FlushFinalBlock()
        [Array]::Clear($keys, 0, $keys.Length)
    } finally {
        if ($crypto) { $crypto.Dispose() }
        if ($outputStream) { $outputStream.Dispose() }
        if ($aes) { $aes.Dispose() }
        $stream.Dispose()
    }
}
