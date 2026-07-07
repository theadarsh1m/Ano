const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));
let changedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Check if "use client" is not the first statement
  const lines = content.split('\n');
  const useClientIndex = lines.findIndex(l => l.trim() === '"use client";' || l.trim() === "'use client';");
  
  if (useClientIndex > 0) {
    // Remove it from current position
    lines.splice(useClientIndex, 1);
    // Put it at the top
    lines.unshift('"use client";');
    content = lines.join('\n');
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Fixed "use client" in ${file}`);
    changedCount++;
  }
}

console.log(`Fixed ${changedCount} files.`);
