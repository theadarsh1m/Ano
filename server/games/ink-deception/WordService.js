/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

class WordService {
  constructor() {
    this.words = {};
    this.categories = [];
    this.loadWords();
  }

  findWordsJsonPath() {
    const candidatePaths = [
      path.resolve(process.cwd(), 'words.json'),
      path.resolve(__dirname, '../../../words.json'),
      path.resolve(__dirname, '../../words.json'),
      path.resolve(__dirname, '../words.json'),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  loadWords() {
    this.words = {};
    this.categories = [];
    const allWordsSet = new Set();

    // 1. Primary source: words.json from root
    const wordsJsonPath = this.findWordsJsonPath();
    if (wordsJsonPath) {
      try {
        const content = fs.readFileSync(wordsJsonPath, 'utf8');
        const parsed = JSON.parse(content);
        const categoriesData = parsed.categories || parsed;

        if (typeof categoriesData === 'object' && categoriesData !== null) {
          for (const [catName, list] of Object.entries(categoriesData)) {
            if (Array.isArray(list)) {
              const cleanList = list
                .filter(w => typeof w === 'string' && w.trim().length > 0)
                .map(w => w.trim().toLowerCase());

              if (cleanList.length > 0) {
                const normalizedCategory = catName.toLowerCase().trim();
                this.words[normalizedCategory] = cleanList;
                if (!this.categories.includes(normalizedCategory)) {
                  this.categories.push(normalizedCategory);
                }
                cleanList.forEach(w => allWordsSet.add(w));
              }
            }
          }
        }
        console.log(`[Ink & Deception] Loaded ${this.categories.length} categories from words.json (${wordsJsonPath}).`);
      } catch (err) {
        console.error('[Ink & Deception] Failed to parse words.json:', err);
      }
    }

    // 2. Check local words directory for any additional custom category JSONs
    const wordsDir = path.join(__dirname, 'words');
    if (fs.existsSync(wordsDir)) {
      const files = fs.readdirSync(wordsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const category = file.replace('.json', '').toLowerCase().trim();
          try {
            const content = fs.readFileSync(path.join(wordsDir, file), 'utf8');
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              const cleanList = parsed
                .filter(w => typeof w === 'string' && w.trim().length > 0)
                .map(w => w.trim().toLowerCase());

              if (!this.words[category]) {
                this.words[category] = cleanList;
                if (!this.categories.includes(category)) {
                  this.categories.push(category);
                }
              } else {
                this.words[category] = Array.from(new Set([...this.words[category], ...cleanList]));
              }
              cleanList.forEach(w => allWordsSet.add(w));
            }
          } catch (e) {
            console.error(`[Ink & Deception] Failed to load word list ${file}:`, e);
          }
        }
      }
    }

    // Fallback if empty
    if (allWordsSet.size === 0) {
      const fallbackAnimals = ["dog", "cat", "elephant", "lion", "tiger", "bear", "monkey", "giraffe", "zebra", "penguin", "dolphin", "whale", "shark", "octopus", "butterfly", "spider", "snake", "crocodile", "frog", "turtle", "rabbit", "panda"];
      const fallbackFood = ["pizza", "apple", "cake", "donut", "taco", "egg", "bread", "banana", "pear", "milk", "cookie", "carrot", "grape", "orange", "burger", "cheese", "strawberry", "pineapple", "sandwich", "soup", "hotdog", "candy", "popcorn"];
      const fallbackObjects = ["chair", "table", "bed", "lamp", "mirror", "clock", "umbrella", "keys", "wallet", "backpack", "book", "pen", "glasses", "scissors", "guitar", "piano", "shoes", "mug", "fork", "spoon", "knife", "cup", "plate", "soap"];

      this.words['animals'] = fallbackAnimals;
      this.words['food'] = fallbackFood;
      this.words['objects'] = fallbackObjects;
      this.categories = ['animals', 'food', 'objects'];
      [...fallbackAnimals, ...fallbackFood, ...fallbackObjects].forEach(w => allWordsSet.add(w));
    }

    this.words['mixed'] = Array.from(allWordsSet);
    if (!this.categories.includes('mixed')) {
      this.categories.unshift('mixed');
    }

    console.log(`[Ink & Deception] Ready with ${this.categories.length} categories and ${allWordsSet.size} total words.`);
  }

  getWordChoices(category = 'mixed', count = 3, excludeWords = []) {
    const normCat = (category || 'mixed').toLowerCase().trim();
    let wordList = [];

    if (normCat === 'mixed') {
      wordList = this.words['mixed'] || [];
    } else {
      wordList = this.words[normCat] || this.words['mixed'] || [];
    }

    if (!wordList || wordList.length === 0) {
      wordList = ["APPLE", "DRAGON", "ROCKET", "SUSHI", "CONTROLLER", "PENGUIN", "PIZZA"];
    }

    const upperExclude = excludeWords.map(w => String(w).toUpperCase().trim());
    let availableWords = wordList.filter(w => !upperExclude.includes(String(w).toUpperCase().trim()));
    if (availableWords.length < count) {
      availableWords = wordList;
    }

    const shuffled = [...availableWords].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(w => String(w).toUpperCase());
  }

  getAllCategories() {
    return this.categories.length > 0 ? this.categories : ['mixed'];
  }
}

module.exports = new WordService();
