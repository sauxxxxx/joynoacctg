param([string]$BackupDirectory = 'D:\Joyno\Backups\joynoacctg')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$directory = [IO.Path]::GetFullPath($BackupDirectory)
$expected = [IO.Path]::GetFullPath('D:\Joyno\Backups\joynoacctg')
if ($directory -ne $expected) { throw 'This installer is scoped to D:\Joyno\Backups\joynoacctg.' }
$taskName = 'Joyno Accounting - PC Backup'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { throw 'The backup task already exists. Review it before changing its schedule.' }
if (Test-Path -LiteralPath $directory) { throw 'The backup folder already exists. Review it before installing.' }
[void](New-Item -ItemType Directory -Path $directory)
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$acl = New-Object Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$acl.SetOwner($identity.User)
$inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
foreach ($sid in @($identity.User, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
    $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', $inheritance, 'None', 'Allow')
    $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $directory -AclObject $acl
$toolDirectory = Join-Path $directory 'tools'
[void](New-Item -ItemType Directory -Path $toolDirectory)
foreach ($filename in @('windows-backup.ps1', 'windows-backup-crypto.ps1', 'portable-backup-crypto.ps1', 'windows-recovery.ps1', 'restore-portable-backup.ps1')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $filename) -Destination (Join-Path $toolDirectory $filename)
}
$script = Join-Path $toolDirectory 'windows-backup.ps1'
$action = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$script`""
$triggers = @((New-ScheduledTaskTrigger -Daily -At '07:00'), (New-ScheduledTaskTrigger -AtLogOn -User $identity.Name))
$principal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Description 'Copies completed Joyno PostgreSQL backups over SSH and encrypts them for this Windows user. Requires this PC to be logged in.' | Out-Null
Write-Output "Installed daily 07:00 and sign-in backup copies for $($identity.Name)."
Write-Output "Backup folder: $directory"
