- Found that 'dev-install.sh' was calling 'npm run bundle' which does not exist in 'package.json'.
- 'package.json' has a 'compile' script that runs 'webpack'.
- Verified 'npm run compile' works after 'npm install'.
- Successfully updated 'dev-install.sh' lines 88 and 172 to use 'compile' instead of 'bundle'.

## Learning: node_modules removal robustness
- Modified dev-install.sh to handle failures of 'rm -rf node_modules'.
- Even with 'set -e', explicit error handling with a helpful message is better for user experience.
- On macOS, file locks can cause 'rm -rf' to fail even with the '-f' flag if the directory is being actively watched or used by another process (like VS Code or a running extension).
