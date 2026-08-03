const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      results.push(file);
    }
  });
  return results;
};

const files = walk('src/components/games/anigravity').concat(walk('src/types/anigravity'));

files.forEach(file => {
  if (file.endsWith('.ts') || file.endsWith('.tsx')) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace aliases
    content = content.replace(/@\/game\//g, '@/components/games/anigravity/');
    content = content.replace(/@\/types\/character/g, '@/types/anigravity/character');
    content = content.replace(/@\/types\/game/g, '@/types/anigravity/game');
    content = content.replace(/@\/network\/socket/g, '@/lib/socket');
    
    // In characters.ts replace sprite and collider paths
    if (file.endsWith('characters.ts')) {
      content = content.replace(/\/sprites\//g, '/games/anigravity/sprites/');
      content = content.replace(/\/colliders\//g, '/games/anigravity/colliders/');
    }

    fs.writeFileSync(file, content);
  }
});

console.log('Patched all files successfully.');
