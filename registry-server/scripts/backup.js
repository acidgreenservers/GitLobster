const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const STORAGE_DIR = 'storage';
const BACKUP_DIR = 'backups';

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

// Generate timestamp
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const filename = `gitlobster-backup-${timestamp}.tar.gz`;
const backupPath = path.join(BACKUP_DIR, filename);

console.log(`📦 Creating backup of '${STORAGE_DIR}'...`);

// Create tarball
// Excluding .gitkeep files to keep backup clean if wanted, but -a is fine
// Using tar -czf
const command = `tar -czf "${backupPath}" "${STORAGE_DIR}"`;

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`❌ Backup failed: ${error.message}`);
        return;
    }
    if (stderr) {
        console.warn(`⚠️  Tar warning: ${stderr}`);
    }

    // Get file size
    const stats = fs.statSync(backupPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`✅ Backup complete!`);
    console.log(`📁 File: ${backupPath}`);
    console.log(`wv Size: ${sizeMB} MB`);
});
