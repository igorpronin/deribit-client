const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const watchDir = './src'; // Directory to watch
const commandToRun = 'echo "Files changed!"'; // Replace with your desired command

console.log(`Watching for file changes in ${watchDir}`);

fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
  if (filename) {
    const filePath = path.join(watchDir, filename);
    console.log(`File ${filePath} has been ${eventType}`);

    exec(commandToRun, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error}`);
        return;
      }
      if (stdout) console.log(`Command output: ${stdout}`);
      if (stderr) console.error(`Command errors: ${stderr}`);
    });
  }
});

// Prevent the Node.js process from exiting
process.stdin.resume();

console.log('File watcher started. Press Ctrl+C to exit.');
