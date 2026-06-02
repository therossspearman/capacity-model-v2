const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'frontend/worker/workerCodeSource.js');
const targetPath = path.join(__dirname, 'frontend/worker/workerCode_v4.js');

try {
    const sourceCode = fs.readFileSync(sourcePath, 'utf8');
    const base64Code = Buffer.from(sourceCode).toString('base64');
    const fileContent = `export const workerCode = "${base64Code}";\n`;

    fs.writeFileSync(targetPath, fileContent);
    console.log('Successfully updated workerCode_v4.js with base64 encoded source.');
} catch (error) {
    console.error('Error updating worker code:', error);
    process.exit(1);
}
