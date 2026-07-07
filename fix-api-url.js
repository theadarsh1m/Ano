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

  // Pattern 1: const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
  // Pattern 2: const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
  // Note: we can just match any assignment to API_URL that looks like that.

  const pattern = /const\s+API_URL\s*=\s*process\.env\.NEXT_PUBLIC_SOCKET_URL\s*\|\|\s*['"]http:\/\/localhost:3001['"]\s*;/g;

  if (pattern.test(content)) {
    content = content.replace(pattern, '');
    
    // add import to top
    if (!content.includes('import { API_URL }')) {
      content = 'import { API_URL } from "@/lib/config";\n' + content;
    }
  }

  // Also replace inline fetches
  const fetchPattern = /\$\{process\.env\.NEXT_PUBLIC_SOCKET_URL\s*\|\|\s*['"]http:\/\/localhost:3001['"]\}/g;
  if (fetchPattern.test(content)) {
    content = content.replace(fetchPattern, '${API_URL}');
    if (!content.includes('import { API_URL }')) {
      content = 'import { API_URL } from "@/lib/config";\n' + content;
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
    changedCount++;
  }
}

console.log(`Updated ${changedCount} files.`);
