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
        console.log(`[Scribble] Loaded ${this.categories.length} categories (${allWordsSet.size} total words) from words.json (${wordsJsonPath}).`);
      } catch (err) {
        console.error('[Scribble] Failed to parse words.json:', err);
      }
    }

    // Also check local words directory for any additional custom lists
    const wordsDir = path.join(__dirname, 'words');
    if (fs.existsSync(wordsDir)) {
      const files = fs.readdirSync(wordsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const category = file.replace('.json', '').toLowerCase();
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
                // Merge without duplicates
                const merged = Array.from(new Set([...this.words[category], ...cleanList]));
                this.words[category] = merged;
              }
              cleanList.forEach(w => allWordsSet.add(w));
            }
          } catch (e) {
            console.error(`[Scribble] Failed to load local word list ${file}:`, e);
          }
        }
      }
    }

    // If no words were loaded, use robust fallback
    if (allWordsSet.size === 0) {
      const defaultAnimals = ["dog", "cat", "elephant", "lion", "tiger", "bear", "monkey", "giraffe", "zebra", "penguin", "dolphin", "whale", "shark", "octopus", "butterfly", "spider", "snake", "crocodile", "frog", "turtle", "rabbit", "panda"];
      const defaultFood = ["apple", "banana", "orange", "grape", "strawberry", "watermelon", "pineapple", "mango", "pizza", "burger", "taco", "sushi", "pasta", "cookie", "cake", "ice_cream", "sandwich", "donut"];
      const defaultObjects = ["chair", "table", "bed", "lamp", "clock", "mirror", "window", "door", "car", "airplane", "boat", "bicycle", "computer", "phone", "book", "pen", "guitar", "camera", "glasses", "hat"];
      
      this.words['animals'] = defaultAnimals;
      this.words['food'] = defaultFood;
      this.words['objects'] = defaultObjects;
      this.categories = ['animals', 'food', 'objects'];
      
      [...defaultAnimals, ...defaultFood, ...defaultObjects].forEach(w => allWordsSet.add(w));
    }

    // Set mixed category with all words
    this.words['mixed'] = Array.from(allWordsSet);
    if (!this.categories.includes('mixed')) {
      this.categories.unshift('mixed');
    }
  }

  getWordChoices(category = 'mixed', count = 3, excludeWords = []) {
    const normCat = (category || 'mixed').toLowerCase().trim();
    let wordList = this.words[normCat] || this.words['mixed'];
    if (!wordList || wordList.length === 0) {
      wordList = this.words['mixed'] || ["APPLE", "DOG", "HOUSE", "CAR", "TREE", "SUN", "BOOK", "PHONE"];
    }

    const upperExclude = excludeWords.map(w => String(w).toUpperCase().trim());
    let availableWords = wordList.filter(w => !upperExclude.includes(String(w).toUpperCase().trim()));
    if (availableWords.length < count) {
      availableWords = wordList;
    }

    // Shuffle and pick
    const shuffled = [...availableWords].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(w => String(w).toUpperCase());
  }

  getAllCategories() {
    return this.categories.length > 0 ? this.categories : ['mixed'];
  }
}

module.exports = new WordService();
