const CHARACTER_DEFINITIONS = [
  {
    id: 'ballerina-capuchina',
    displayName: 'Ballerina Capuchina',
    spriteFile: '/games/anigravity/sprites/Ballerina-Capuchina.png',
    colliderFile: '/games/anigravity/colliders/Ballerina-Capuchina.json',
    physics: { density: 1.0, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.1 },
    renderScale: 0.075
  },
  {
    id: 'bombardino-crocodillo',
    displayName: 'Bombardino Crocodillo',
    spriteFile: '/games/anigravity/sprites/Bombardino-Crocodillo.png',
    colliderFile: '/games/anigravity/colliders/Bombardino-Crocodillo.json',
    physics: { density: 2.2, friction: 0.95, restitution: 0.0, linearDamping: 0.15, angularDamping: 0.2 },
    renderScale: 0.0625
  },
  {
    id: 'bombini-gusini',
    displayName: 'Bombini Gusini',
    spriteFile: '/games/anigravity/sprites/Bombini-Gusini.png',
    colliderFile: '/games/anigravity/colliders/Bombini-Gusini.json',
    physics: { density: 1.2, friction: 0.95, restitution: 0.0, linearDamping: 0.08, angularDamping: 0.08 },
    renderScale: 0.083
  },
  {
    id: 'boneca-ambalabu-tiktok-brainrot-91647',
    displayName: 'Boneca Ambalabu TikTok',
    spriteFile: '/games/anigravity/sprites/Boneca-Ambalabu-TikTok-Brainrot-91647.png',
    colliderFile: '/games/anigravity/colliders/Boneca-Ambalabu-TikTok-Brainrot-91647.json',
    physics: { density: 0.9, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.1 },
    renderScale: 0.096
  },
  {
    id: 'boneca-ambalabu',
    displayName: 'Boneca Ambalabu',
    spriteFile: '/games/anigravity/sprites/Boneca-Ambalabu.png',
    colliderFile: '/games/anigravity/colliders/Boneca-Ambalabu.json',
    physics: { density: 0.9, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.1 },
    renderScale: 0.153
  },
  {
    id: 'broccoli-assassini',
    displayName: 'Broccoli Assassini',
    spriteFile: '/games/anigravity/sprites/Broccoli-Assassini.png',
    colliderFile: '/games/anigravity/colliders/Broccoli-Assassini.json',
    physics: { density: 1.1, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.15 },
    renderScale: 0.083
  },
  {
    id: 'brr-brr-patapim',
    displayName: 'Brr Brr Patapim',
    spriteFile: '/games/anigravity/sprites/Brr-Brr-Patapim.png',
    colliderFile: '/games/anigravity/colliders/Brr-Brr-Patapim.json',
    physics: { density: 2.5, friction: 0.95, restitution: 0.0, linearDamping: 0.2, angularDamping: 0.25 },
    renderScale: 0.06
  },
  {
    id: 'burbaloni-luliloli',
    displayName: 'Burbaloni Luliloli',
    spriteFile: '/games/anigravity/sprites/Burbaloni-Luliloli.png',
    colliderFile: '/games/anigravity/colliders/Burbaloni-Luliloli.json',
    physics: { density: 1.3, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.1 },
    renderScale: 0.083
  },
  {
    id: 'cappuccino-assassino',
    displayName: 'Cappuccino Assassino',
    spriteFile: '/games/anigravity/sprites/Cappuccino-Assassino.png',
    colliderFile: '/games/anigravity/colliders/Cappuccino-Assassino.json',
    physics: { density: 1.5, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.12 },
    renderScale: 0.1
  },
  {
    id: 'chimpanzini-bananini',
    displayName: 'Chimpanzini Bananini',
    spriteFile: '/games/anigravity/sprites/Chimpanzini-Bananini.png',
    colliderFile: '/games/anigravity/colliders/Chimpanzini-Bananini.json',
    physics: { density: 1.0, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.1 },
    renderScale: 0.085
  },
  {
    id: 'cocofanto-elefanto',
    displayName: 'Cocofanto Elefanto',
    spriteFile: '/games/anigravity/sprites/Cocofanto-Elefanto.png',
    colliderFile: '/games/anigravity/colliders/Cocofanto-Elefanto.json',
    physics: { density: 2.0, friction: 0.95, restitution: 0.0, linearDamping: 0.15, angularDamping: 0.18 },
    renderScale: 0.107
  },
  {
    id: 'frigo-camelo',
    displayName: 'Frigo Camelo',
    spriteFile: '/games/anigravity/sprites/Frigo-Camelo.png',
    colliderFile: '/games/anigravity/colliders/Frigo-Camelo.json',
    physics: { density: 1.8, friction: 0.95, restitution: 0.0, linearDamping: 0.12, angularDamping: 0.15 },
    renderScale: 0.093
  },
  {
    id: 'la-vaca-saturno-saturnita',
    displayName: 'La Vaca Saturno Saturnita',
    spriteFile: '/games/anigravity/sprites/La-Vaca-Saturno-Saturnita.png',
    colliderFile: '/games/anigravity/colliders/La-Vaca-Saturno-Saturnita.json',
    physics: { density: 1.4, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.12 },
    renderScale: 0.146
  },
  {
    id: 'lirili-larila-elephant',
    displayName: 'Lirilì Larilà Elephant',
    spriteFile: '/games/anigravity/sprites/Lirili-Larila-Elephant.png',
    colliderFile: '/games/anigravity/colliders/Lirili-Larila-Elephant.json',
    physics: { density: 1.6, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.1 },
    renderScale: 0.27
  },
  {
    id: 'orcalero-orcala',
    displayName: 'Orcalero Orcala',
    spriteFile: '/games/anigravity/sprites/Orcalero-Orcala.png',
    colliderFile: '/games/anigravity/colliders/Orcalero-Orcala.json',
    physics: { density: 1.7, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.1 },
    renderScale: 0.103
  },
  {
    id: 'ta-ta-ta-sahur',
    displayName: 'Ta Ta Ta Sahur',
    spriteFile: '/games/anigravity/sprites/Ta-Ta-Ta-Sahur.png',
    colliderFile: '/games/anigravity/colliders/Ta-Ta-Ta-Sahur.json',
    physics: { density: 1.5, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.1 },
    renderScale: 0.088
  },
  {
    id: 'trippa-troppa-tralala-lirili-rila-tung-tung-sahur',
    displayName: 'Trippa Troppa Tralala Lirili Rila',
    spriteFile: '/games/anigravity/sprites/Trippa-Troppa-Tralala-Lirili-Rila-Tung-Tung-Sahur.png',
    colliderFile: '/games/anigravity/colliders/Trippa-Troppa-Tralala-Lirili-Rila-Tung-Tung-Sahur.json',
    physics: { density: 2.0, friction: 0.95, restitution: 0.0, linearDamping: 0.15, angularDamping: 0.2 },
    renderScale: 0.082
  },
  {
    id: 'trippi-troppi',
    displayName: 'Trippi Troppi',
    spriteFile: '/games/anigravity/sprites/Trippi-Troppi.png',
    colliderFile: '/games/anigravity/colliders/Trippi-Troppi.json',
    physics: { density: 1.1, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.1 },
    renderScale: 0.153
  },
  {
    id: 'trippi-troppi1',
    displayName: 'Trippi Troppi 1',
    spriteFile: '/games/anigravity/sprites/Trippi-Troppi1.png',
    colliderFile: '/games/anigravity/colliders/Trippi-Troppi1.json',
    physics: { density: 1.2, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.1 },
    renderScale: 0.09
  },
  {
    id: 'trulimero-trulichina',
    displayName: 'Trulimero Trulichina',
    spriteFile: '/games/anigravity/sprites/Trulimero-Trulichina.png',
    colliderFile: '/games/anigravity/colliders/Trulimero-Trulichina.json',
    physics: { density: 1.3, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.1 },
    renderScale: 0.115
  },
  {
    id: 'tung-tung-tung-sahur',
    displayName: 'Tung Tung Tung Sahur',
    spriteFile: '/games/anigravity/sprites/Tung-Tung-Tung-Sahur.png',
    colliderFile: '/games/anigravity/colliders/Tung-Tung-Tung-Sahur.json',
    physics: { density: 1.4, friction: 0.95, restitution: 0.0, linearDamping: 0.1, angularDamping: 0.15 },
    renderScale: 0.083
  }
];

module.exports = { CHARACTER_DEFINITIONS };
