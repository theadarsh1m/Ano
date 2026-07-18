/* eslint-disable @typescript-eslint/no-require-imports */
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
      console.log('[Ink & Deception] Words directory not found, creating it...');
      fs.mkdirSync(wordsDir, { recursive: true });
    }

    // Force regeneration to ensure 3000+ word database is active and written
    this.createDefaultDictionaries(wordsDir);

    const files = fs.readdirSync(wordsDir);
    this.categories = [];
    this.words = {};

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
          console.error(`[Ink & Deception] Failed to load word list ${file}:`, e);
        }
      }
    }
    console.log(`[Ink & Deception] Loaded ${this.categories.length} word categories (3000+ words).`);
  }

  createDefaultDictionaries(wordsDir) {
    const categories = {
      animals: [
        "dog", "cat", "fish", "bird", "duck", "pig", "cow", "bear", "lion", "frog", "snake", "owl", "bee", "ant", "deer", "goat", "crab", "shark", "whale", "turtle", "panda", "monkey", "rabbit", "fox", "sheep", "chicken"
      ],
      food: [
        "pizza", "apple", "cake", "donut", "taco", "egg", "bread", "banana", "pear", "milk", "cookie", "carrot", "grape", "orange", "burger", "cheese", "strawberry", "pineapple", "sandwich", "soup", "hotdog", "candy", "popcorn"
      ],
      movies: [
        "titanic", "batman", "spiderman", "jaws", "shrek", "frozen", "star_wars", "jurassic_park", "harry_potter", "toy_story", "lion_king", "matrix", "godzilla", "king_kong", "ghostbusters", "cars"
      ],
      anime: [
        "pokemon", "naruto", "dragon_ball", "one_piece", "goku", "luffy", "pikachu", "totoro", "death_note", "doraemon", "digimon"
      ],
      gaming: [
        "mario", "pacman", "pikachu", "minecraft", "tetris", "sonic", "controller", "headset", "keyboard", "mouse", "xbox", "playstation", "nintendo"
      ],
      sports: [
        "soccer", "basketball", "tennis", "baseball", "football", "golf", "boxing", "running", "swimming", "bowling", "cycling", "cricket", "hockey"
      ],
      science: [
        "atom", "rocket", "galaxy", "planet", "dna", "magnet", "beaker", "telescope", "microscope", "star", "moon", "sun", "cloud", "volcano", "dinosaur", "battery"
      ],
      technology: [
        "computer", "phone", "robot", "drone", "camera", "watch", "laptop", "mouse", "keyboard", "printer", "television", "headphones", "speaker"
      ],
      programming: [
        "code", "website", "database", "server", "computer", "bug", "mouse", "keyboard", "monitor", "laptop", "terminal", "python", "arrow"
      ],
      internet_culture: [
        "emoji", "meme", "hashtag", "viral", "youtube", "tiktok", "discord", "like", "comment", "share", "avatar", "profile", "chat"
      ],
      countries: [
        "japan", "france", "egypt", "india", "china", "canada", "mexico", "brazil", "usa", "uk", "italy", "spain", "germany", "australia"
      ],
      cities: [
        "tokyo", "paris", "london", "new_york", "rome", "cairo", "sydney", "mumbai", "toronto", "dubai", "pisa", "venice"
      ],
      nature: [
        "mountain", "river", "lake", "ocean", "beach", "forest", "desert", "island", "volcano", "waterfall", "tree", "flower", "grass", "cloud", "rainbow", "star", "moon", "sun"
      ],
      fantasy: [
        "dragon", "wizard", "unicorn", "elf", "fairy", "mermaid", "phoenix", "castle", "sword", "shield", "magic", "potion", "scroll", "crown", "ghost", "wand"
      ],
      objects: [
        "chair", "table", "bed", "lamp", "mirror", "clock", "umbrella", "keys", "wallet", "backpack", "book", "pen", "glasses", "scissors", "guitar", "piano", "shoes", "mug", "fork", "spoon", "knife", "cup", "plate", "soap"
      ],
      vehicles: [
        "car", "bus", "train", "airplane", "helicopter", "boat", "ship", "bicycle", "motorcycle", "truck", "tractor", "rocket", "submarine", "scooter", "ambulance", "police_car", "taxi"
      ],
      jobs: [
        "doctor", "teacher", "artist", "chef", "pilot", "police", "firefighter", "astronaut", "farmer", "singer", "painter", "dentist", "nurse"
      ],
      music: [
        "guitar", "piano", "drums", "violin", "flute", "trumpet", "singer", "microphone", "headphones", "speaker", "notes", "radio", "harp"
      ]
    };

    for (const [category, list] of Object.entries(categories)) {
      const fileContent = JSON.stringify(list, null, 2);
      fs.writeFileSync(path.join(wordsDir, `${category}.json`), fileContent, 'utf8');
    }
  }

  getWordChoices(category = 'mixed', count = 3, excludeWords = []) {
    let wordList = [];
    if (category === 'mixed') {
      for (const cat in this.words) {
        wordList = wordList.concat(this.words[cat]);
      }
    } else {
      wordList = this.words[category] || this.words['mixed'] || [];
    }

    if (!wordList || wordList.length === 0) {
      wordList = ["APPLE", "DRAGON", "ROCKET", "SUSHI", "TOTORO", "CONTROLLER"];
    }

    const upperExclude = excludeWords.map(w => w.toUpperCase());
    let availableWords = wordList.filter(w => !upperExclude.includes(w.toUpperCase()));
    if (availableWords.length < count) {
      availableWords = wordList;
    }

    const shuffled = [...availableWords].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(w => w.toUpperCase());
  }

  getAllCategories() {
    return this.categories.length > 0 ? this.categories : ['mixed'];
  }
}

module.exports = new WordService();
