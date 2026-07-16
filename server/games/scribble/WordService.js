const fs = require('fs');
const path = require('path');

class WordService {
  constructor() {
    this.words = {};
    this.categories = [];
    this.loadWords();
  }

  loadWords() {
    const wordsDir = path.join(__dirname, 'words');
    if (!fs.existsSync(wordsDir)) {
      console.log('Words directory not found, creating it...');
      fs.mkdirSync(wordsDir, { recursive: true });
      // Create some default categories if they don't exist
      this.createDefaultDictionaries(wordsDir);
    }

    const files = fs.readdirSync(wordsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const category = file.replace('.json', '');
        try {
          const content = fs.readFileSync(path.join(wordsDir, file), 'utf8');
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            this.words[category] = parsed;
            this.categories.push(category);
          }
        } catch (e) {
          console.error(`Failed to load word list ${file}:`, e);
        }
      }
    }
    console.log(`Loaded ${this.categories.length} word categories for Scribble.`);
  }

  createDefaultDictionaries(wordsDir) {
    const defaultAnimals = ["dog", "cat", "elephant", "lion", "tiger", "bear", "monkey", "giraffe", "zebra", "penguin", "dolphin", "whale", "shark", "octopus", "butterfly", "spider", "snake", "crocodile", "frog", "turtle", "eagle", "owl", "parrot", "peacock", "ostrich", "kangaroo", "koala", "panda", "hippopotamus", "rhinoceros", "camel", "horse", "cow", "pig", "sheep", "goat", "chicken", "duck", "goose", "swan", "pigeon", "crow", "mouse", "rat", "squirrel", "rabbit", "deer", "fox", "wolf", "bat"];
    const defaultFood = ["apple", "banana", "orange", "grape", "strawberry", "watermelon", "pineapple", "mango", "peach", "cherry", "pear", "plum", "kiwi", "lemon", "lime", "coconut", "avocado", "tomato", "potato", "onion", "carrot", "broccoli", "spinach", "lettuce", "cucumber", "pepper", "mushroom", "corn", "peas", "beans", "bread", "cheese", "milk", "egg", "butter", "yogurt", "pizza", "burger", "hotdog", "sandwich", "taco", "sushi", "pasta", "rice", "noodle", "soup", "salad", "steak", "chicken", "fish"];
    const defaultObjects = ["chair", "table", "bed", "sofa", "desk", "lamp", "clock", "mirror", "window", "door", "wall", "floor", "ceiling", "roof", "house", "building", "car", "bus", "train", "airplane", "boat", "ship", "bicycle", "motorcycle", "computer", "laptop", "phone", "tablet", "television", "radio", "camera", "watch", "glasses", "hat", "shirt", "pants", "shoes", "socks", "jacket", "coat", "book", "pen", "pencil", "paper", "notebook", "bag", "backpack", "wallet", "keys", "umbrella"];
    const defaultMixed = [...defaultAnimals, ...defaultFood, ...defaultObjects, "sun", "moon", "star", "cloud", "rain", "snow", "wind", "storm", "lightning", "thunder", "fire", "water", "earth", "tree", "flower", "grass", "leaf", "mountain", "river", "lake", "ocean", "beach", "sand", "rock", "stone", "city", "town", "village", "street", "road", "bridge", "park", "garden", "forest", "jungle", "desert", "island"];

    fs.writeFileSync(path.join(wordsDir, 'animals.json'), JSON.stringify(defaultAnimals, null, 2));
    fs.writeFileSync(path.join(wordsDir, 'food.json'), JSON.stringify(defaultFood, null, 2));
    fs.writeFileSync(path.join(wordsDir, 'objects.json'), JSON.stringify(defaultObjects, null, 2));
    fs.writeFileSync(path.join(wordsDir, 'mixed.json'), JSON.stringify(defaultMixed, null, 2));
  }

  getWordChoices(category = 'mixed', count = 3, excludeWords = []) {
    let wordList = this.words[category] || this.words['mixed'];
    if (!wordList || wordList.length === 0) {
      // Fallback
      wordList = ["apple", "dog", "house", "car", "tree", "sun", "book", "phone"];
    }

    // Filter out excluded words (recently used)
    let availableWords = wordList.filter(w => !excludeWords.includes(w.toUpperCase()));
    if (availableWords.length < count) {
      // If we run out of words, reset exclusions for this pull
      availableWords = wordList;
    }

    // Shuffle and pick
    const shuffled = [...availableWords].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(w => w.toUpperCase());
  }

  getAllCategories() {
    return this.categories.length > 0 ? this.categories : ['mixed'];
  }
}

module.exports = new WordService();
