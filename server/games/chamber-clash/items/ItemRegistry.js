const fs = require('fs');
const path = require('path');

class ItemRegistry {
  constructor() {
    this.items = new Map();
    this.loadItems();
  }

  loadItems() {
    const itemsDir = path.join(__dirname);
    const files = fs.readdirSync(itemsDir);
    
    files.forEach(file => {
      if (file.endsWith('.js') && file !== 'ItemRegistry.js') {
        const itemClass = require(path.join(itemsDir, file));
        if (itemClass && itemClass.id) {
          this.items.set(itemClass.id, itemClass);
        }
      }
    });
  }

  getItem(id) {
    return this.items.get(id);
  }

  getAllItems() {
    return Object.fromEntries(this.items);
  }
}

module.exports = new ItemRegistry();
