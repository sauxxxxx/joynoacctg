# Joyno accounting backups

Approved destination: `D:\Joyno\Backups\joynoacctg` on the owner's Windows PC.

The VPS creates a PostgreSQL custom-format dump each night at approximately 03:00 Manila time. Only successfully created, archive-checked dumps receive a SHA-256 manifest and can be downloaded. The PC copies the latest completed dump at 07:00 and at Windows sign-in. The scheduled task runs as the current Windows user without storing an account password. The PC must be online and signed in; missed runs resume when possible. No existing backups are automatically deleted.

The PC checks the server checksum, encrypts each copy with AES-256-CBC plus HMAC-SHA256, and verifies that it decrypts to the same checksum before keeping it. The random encryption key is protected by Windows DPAPI for the current Windows account. The backup folder is restricted to that account and Windows SYSTEM. No database passwords or SSH private keys are copied into it.

**Recovery limitation:** the scheduled `.joynobackup` copies require the original Windows account's DPAPI keys. Copying those files alone to a new PC is not sufficient. The portable recovery command below removes that dependency for each exported archive, but the owner must choose a private passphrase and keep the resulting file separately. No portable production copy exists until that command succeeds.

## Status

Check `status.json` in the backup folder and the task **Joyno Accounting - PC Backup** in Task Scheduler. A successful copy should be less than 36 hours old. Task failures return a nonzero result. The VPS service status is:

```sh
systemctl status joynoacctg-backup.timer joynoacctg-backup.service
journalctl -u joynoacctg-backup.service --since yesterday
```

## Manual copy and restore verification

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Joyno\Backups\joynoacctg\tools\windows-backup.ps1" -VerifyRestore
```

This decrypts the PC copy, verifies its checksum, transfers it to a unique staging file on the VPS, and restores it into a randomly named disposable PostgreSQL database. It never restores over the live company. The disposable database and staging dump are removed afterward. Local plaintext verification/download files created by the run are removed; this is ordinary deletion, not a secure-erasure guarantee.

To decrypt a copy for a deliberate recovery, use PowerShell under the same Windows account:

```powershell
. 'D:\Joyno\Backups\joynoacctg\tools\windows-backup-crypto.ps1'
Unprotect-JoynoBackup 'D:\Joyno\Backups\joynoacctg\CHOOSE-BACKUP.dump.joynobackup' 'D:\Joyno\Backups\joynoacctg\recovery.dump'
```

Choose a real backup filename. The destination must not exist. Do not restore over production without first verifying the backup, taking a fresh backup, and planning the recovery. Backups include uploaded private document contents and metadata because both are stored in PostgreSQL. They do not cover other applications, server configuration, or the SSH key.

The task's `ExecutionPolicy Bypass` applies only to its PowerShell process. It does not change the machine or user execution policy. Keep the tools and the SSH identity restricted to trusted users.

## Portable recovery copy (owner action)

Run this under the existing Windows account. It chooses the latest completed PC backup and asks twice for a hidden 16–128-character recovery passphrase. Use a long unique passphrase; do not send it to chat.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Joyno\Backups\joynoacctg\tools\windows-recovery.ps1"
```

The tool decrypts the DPAPI copy temporarily, encrypts a separate `.joynoportable` archive, decrypts that portable archive again and compares checksums before retaining it. It refuses to overwrite an existing recovery copy. The format uses AES-256-CBC with encrypt-then-HMAC-SHA256, random salt/IV, and PBKDF2-HMAC-SHA256 at 600,000 iterations. Wrong passphrases and changed archives are rejected before plaintext output is created. Disposable round-trip, wrong-passphrase and tamper tests passed; this is not a claim of independent cryptographic certification.

Copy the printed portable filename and all three scripts (`restore-portable-backup.ps1`, `portable-backup-crypto.ps1`, `windows-backup-crypto.ps1`) to a separate trusted device. Keep the passphrase separately. Losing the passphrase makes this archive unrecoverable. This is a manual export of that specific backup, not an automatically updated portable backup. Repeat after important changes; scheduled DPAPI copies continue normally.

To recover on a Windows PC without the original profile, put the three scripts together, create a restricted destination folder and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Recovery\restore-portable-backup.ps1" -SourceArchive "C:\Recovery\CHOOSE-ARCHIVE.joynoportable" -DestinationDump "C:\Recovery\recovery.dump"
```

The command asks privately for the passphrase. The resulting dump is sensitive plaintext; verify it in a disposable PostgreSQL database before any deliberate production recovery. The command never changes the live database. Temporary file cleanup is ordinary deletion, not secure erasure. Keeping every copy on the same PC does not protect against loss of that PC.
