#!/usr/bin/env node
/**
 * Build script to encode workerCodeSource.js to Base64 for workerCode.js
 * 
 * Usage: node buildWorker.js
 * 
 * This is needed because:
 * 1. The Airtable blocks bundler minifies JS code
 * 2. Minification caused variable name collision ("meta" -> "me")
 * 3. Storing as Base64 prevents bundler from parsing the worker code
 * 
 * Workflow:
 * 1. Edit workerCodeSource.js (readable JavaScript)
 * 2. Run: node buildWorker.js
 * 3. Commit both files
 */

const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, 'workerCodeSource.js');
const outputFile = path.join(__dirname, 'workerCode_v4.js');

try {
    const source = fs.readFileSync(sourceFile, 'utf8');
    const encoded = Buffer.from(source).toString('base64');

    const output = `export const workerCode = "${encoded}";\n`;
    fs.writeFileSync(outputFile, output);

    console.log('✅ Worker code encoded successfully!');
    console.log(`   Source: ${source.length} bytes (${source.split('\n').length} lines)`);
    console.log(`   Output: ${encoded.length} bytes (Base64)`);
} catch (err) {
    console.error('❌ Error encoding worker:', err.message);
    process.exit(1);
}
