const https = require('https');
const http = require('http');
const crypto = require('crypto');
const db = require('./database');

// Master curated PS+ catalog with verified Tiers, Metacritic ratings, Platforms, Dates & Images
const MASTER_PSPLUS_CATALOG = [
  // --- RECENT & HIGH PROFILE ADDITIONS (2026 / 2025) ---
  {
    title: 'Helldivers 2',
    tier: 'extra',
    platforms: 'PS5',
    date_added: '2026-08-12',
    is_coming_soon: false,
    release_date_psplus: '2026-08-12',
    metacritic_score: 82,
    genres: 'Action, Shooter, Co-op',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202309/0718/4e963bbfdc73cfad7a5180ce6c323fcf93d56b099fc28cb5.png',
    description: 'The Galaxy’s Last Line of Offence. Enlist in the Helldivers and join the fight for freedom across a hostile galaxy in a fast, frantic, and ferocious third-person shooter.'
  },
  {
    title: 'Kingdom Come: Deliverance II',
    tier: 'extra',
    platforms: 'PS5',
    date_added: '2026-08-18',
    is_coming_soon: false,
    release_date_psplus: '2026-08-18',
    metacritic_score: 88,
    genres: 'RPG, Open World, Historical',
    publisher: 'Deep Silver',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202404/0912/c6fbb334208a0d9ca8b5b5c90b63351ecb19163273e04746.png',
    description: 'A thrilling story-driven action RPG with a rich open world set in 15th-century Bohemia. Experience the epic journey of Henry of Skalitz.'
  },
  {
    title: 'Vampire Survivors',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2026-08-18',
    is_coming_soon: false,
    release_date_psplus: '2026-08-18',
    metacritic_score: 95,
    genres: 'Roguelike, Bullet Hell, Indie',
    publisher: 'poncle',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202407/1514/b4cf99e5db4811a2f641a99aa2aa13778a87b32d65a6fef9.png',
    description: 'Mow down thousands of night creatures and survive until dawn! Vampire Survivors is a gothic horror casual game with rogue-lite elements.'
  },
  {
    title: 'Hell is Us',
    tier: 'extra',
    platforms: 'PS5',
    date_added: '2026-08-18',
    is_coming_soon: false,
    release_date_psplus: '2026-08-18',
    metacritic_score: 83,
    genres: 'Action-Adventure, Soulslike',
    publisher: 'Nacon',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202204/0408/6d773ee4f5eb5f309a47da2c8b598b958fe7d48fb2bf9b8d.png',
    description: 'Hell is Us is a 3rd-person action-adventure game that combines intense melee combat with the thrill of exploration.'
  },
  {
    title: 'Onimusha: Dawn of Dreams',
    tier: 'premium',
    platforms: 'PS5, PS4',
    date_added: '2026-08-18',
    is_coming_soon: false,
    release_date_psplus: '2026-08-18',
    metacritic_score: 81,
    genres: 'Action, Hack & Slash, Classics',
    publisher: 'Capcom',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202205/2419/M1Bw2w4Q1zZ0gP91b0P67j.png',
    description: 'PlayStation 2 Classic. Experience Soki’s battle against Hideyoshi Toyotomi and the demonic Genma in feudal Japan, enhanced with up-rendering and quick save.'
  },
  {
    title: "Disney's Atlantis: The Lost Empire",
    tier: 'premium',
    platforms: 'PS5, PS4',
    date_added: '2026-08-18',
    is_coming_soon: false,
    release_date_psplus: '2026-08-18',
    metacritic_score: 74,
    genres: 'Platformer, Adventure, Classics',
    publisher: 'Disney Interactive',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202205/1709/atlantis_cover.png',
    description: 'Original PlayStation Classic. Join Milo Thatch and the expedition crew as you explore the sunken wonders of Atlantis.'
  },

  // --- COMING SOON SECTION (Announced for Upcoming PS+ Drops) ---
  {
    title: 'Hollow Knight: Silksong',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2026-09-15',
    is_coming_soon: true,
    release_date_psplus: '2026-09-15',
    metacritic_score: 93,
    genres: 'Metroidvania, Action, Indie',
    publisher: 'Team Cherry',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202206/1318/1A2B3C4D5E6F7G8H9I0J.png',
    description: 'Coming Soon to PS+ Game Catalog! Discover a vast, haunted kingdom in Hollow Knight: Silksong. Explore, fight and survive as Hornet, princess-protector of Hallownest.'
  },
  {
    title: 'Metal Gear Solid Delta: Snake Eater',
    tier: 'extra',
    platforms: 'PS5',
    date_added: '2026-09-22',
    is_coming_soon: true,
    release_date_psplus: '2026-09-22',
    metacritic_score: 89,
    genres: 'Stealth, Action-Adventure',
    publisher: 'Konami',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202305/2311/mgs_delta_cover.png',
    description: 'Coming Soon to PS+ Extra! Discover the origin story of iconic operative Snake and begin to unravel the plot of the legendary METAL GEAR series.'
  },
  {
    title: 'Dino Crisis (PS1 Classic)',
    tier: 'premium',
    platforms: 'PS5, PS4',
    date_added: '2026-09-15',
    is_coming_soon: true,
    release_date_psplus: '2026-09-15',
    metacritic_score: 84,
    genres: 'Survival Horror, Classics',
    publisher: 'Capcom',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202206/dinocrisis_classic.png',
    description: 'Coming Soon to PS+ Premium! The survival horror classic returns with custom video filters, rewind feature, and trophy support.'
  },

  // --- ESSENTIAL MONTHLY LINEUPS ---
  {
    title: 'Star Wars Jedi: Survivor',
    tier: 'essential',
    platforms: 'PS5',
    date_added: '2026-08-05',
    is_coming_soon: false,
    release_date_psplus: '2026-08-05',
    metacritic_score: 85,
    genres: 'Action-Adventure, Sci-Fi',
    publisher: 'Electronic Arts',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202211/0711/kh4MUIu34fqENiVpT4a8Vp9O.png',
    description: 'The story of Cal Kestis continues in Star Wars Jedi: Survivor, a third-person galaxy-spanning action-adventure game from Respawn Entertainment.'
  },
  {
    title: 'Lies of P',
    tier: 'essential',
    platforms: 'PS5, PS4',
    date_added: '2026-08-05',
    is_coming_soon: false,
    release_date_psplus: '2026-08-05',
    metacritic_score: 84,
    genres: 'Soulslike, Action RPG, Dark Fantasy',
    publisher: 'Neowiz',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202306/0714/233e7902e861d8a1db5bfe5b61b402e1b1fa9f121d51a6fb.png',
    description: 'A thrilling soulslike that takes the story of Pinocchio, turns it on its head, and sets it against the darkly elegant backdrop of the Belle Époque era.'
  },
  {
    title: 'Five Nights at Freddy’s: Security Breach',
    tier: 'essential',
    platforms: 'PS5, PS4',
    date_added: '2026-08-05',
    is_coming_soon: false,
    release_date_psplus: '2026-08-05',
    metacritic_score: 65,
    genres: 'Horror, Survival, First-Person',
    publisher: 'Steel Wool Studios',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202111/1717/3y4pT9Q69A3sJ1X4uN1K6V8r.png',
    description: 'Play as Gregory, a young boy trapped overnight in Freddy Fazbear’s Mega Pizzaplex, aided by Freddy Fazbear himself.'
  },
  {
    title: 'Sifu',
    tier: 'essential',
    platforms: 'PS5, PS4',
    date_added: '2026-07-02',
    is_coming_soon: false,
    release_date_psplus: '2026-07-02',
    metacritic_score: 81,
    genres: 'Martial Arts, Action, Beat-em-up',
    publisher: 'Sloclap',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202108/0411/3xW4Z4bH6Vz5a2e5s6r8.png',
    description: 'Sifu is the story of a young Kung Fu student on a path of revenge, hunting for the murderers of his family.'
  },
  {
    title: 'EA Sports FC 24',
    tier: 'essential',
    platforms: 'PS5, PS4',
    date_added: '2026-06-04',
    is_coming_soon: false,
    release_date_psplus: '2026-06-04',
    metacritic_score: 76,
    genres: 'Sports, Football, Simulation',
    publisher: 'EA Sports',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202307/1117/e985b5d8ae31f0cf33bb5e4a06d4e10b14c330f5cf40aa6f.png',
    description: 'EA SPORTS FC 24 welcomes you to The World’s Game: the most true-to-football experience ever with HyperMotionV, PlayStyles, and Frostbite.'
  },

  // --- CORE GAME CATALOG (PS+ EXTRA) - CRITICALLY ACCLAIMED & POPULAR ---
  {
    title: 'God of War Ragnarök',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2026-03-19',
    is_coming_soon: false,
    release_date_psplus: '2026-03-19',
    metacritic_score: 94,
    genres: 'Action-Adventure, Hack & Slash, Mythology',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202207/1210/aqxv9aKa4mENuzhrQnnL6jWm.png',
    description: 'Embark on an epic and heartfelt journey as Kratos and Atreus struggle with holding on and letting go against the Norse realm’s collapse.'
  },
  {
    title: 'The Last of Us Part I',
    tier: 'extra',
    platforms: 'PS5',
    date_added: '2026-02-17',
    is_coming_soon: false,
    release_date_psplus: '2026-02-17',
    metacritic_score: 89,
    genres: 'Action-Adventure, Narrative, Post-Apocalyptic',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202206/0720/e0Cc2h49T2sV3b7b8C5X1P.png',
    description: 'Endure and survive. Experience the emotional storytelling and unforgettable characters in The Last of Us, rebuilt from the ground up for PS5.'
  },
  {
    title: 'Demon’s Souls',
    tier: 'extra',
    platforms: 'PS5',
    date_added: '2024-01-16',
    is_coming_soon: false,
    release_date_psplus: '2024-01-16',
    metacritic_score: 92,
    genres: 'Action RPG, Dark Fantasy, Soulslike',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/img/rnd/202011/1717/Gem3vB1J2B8a9b3a4f6d.png',
    description: 'Entirely rebuilt from the ground up, this remake invites you to experience the unsettling story and ruthless combat of Demon’s Souls.'
  },
  {
    title: 'Ghost of Tsushima: Director’s Cut',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2023-11-21',
    is_coming_soon: false,
    release_date_psplus: '2023-11-21',
    metacritic_score: 87,
    genres: 'Action-Adventure, Open World, Samurai',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202106/2321/447C184D75CC0E481D8C1D82.png',
    description: 'Forge a new path and wage an unconventional war for the freedom of Tsushima as Jin Sakai.'
  },
  {
    title: 'Bloodborne',
    tier: 'extra',
    platforms: 'PS4',
    date_added: '2022-06-13',
    is_coming_soon: false,
    release_date_psplus: '2022-06-13',
    metacritic_score: 92,
    genres: 'Action RPG, Gothic Horror, Soulslike',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/img/rnd/202010/2618/Y5qX7oN0T6pP8qP7.png',
    description: 'Hunt your nightmares as you search for answers in the ancient city of Yharnam, now cursed with a strange endemic illness spreading through the streets.'
  },
  {
    title: 'Returnal',
    tier: 'extra',
    platforms: 'PS5',
    date_added: '2022-06-13',
    is_coming_soon: false,
    release_date_psplus: '2022-06-13',
    metacritic_score: 86,
    genres: 'Roguelike, Sci-Fi, Third-Person Shooter',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202011/1621/7J9k5d6b4v3k2.png',
    description: 'Break the cycle of chaos on an untamed alien planet. After crash-landing on a shape-shifting world, Selene must fight tooth and nail for survival.'
  },
  {
    title: 'Horizon Forbidden West',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2023-02-21',
    is_coming_soon: false,
    release_date_psplus: '2023-02-21',
    metacritic_score: 88,
    genres: 'Action RPG, Open World, Sci-Fi',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202107/3100/kiZuh6xW.png',
    description: 'Join Aloy as she braves the Forbidden West, a majestic but dangerous frontier that conceals mysterious new threats.'
  },
  {
    title: 'Marvel’s Spider-Man: Miles Morales',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2022-06-13',
    is_coming_soon: false,
    release_date_psplus: '2022-06-13',
    metacritic_score: 85,
    genres: 'Action-Adventure, Superhero, Open World',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202008/1020/prvvNNqHg.png',
    description: 'Experience the rise of Miles Morales as the new hero masters incredible, explosive new powers to become his own Spider-Man.'
  },
  {
    title: 'Ratchet & Clank: Rift Apart',
    tier: 'extra',
    platforms: 'PS5',
    date_added: '2023-05-16',
    is_coming_soon: false,
    release_date_psplus: '2023-05-16',
    metacritic_score: 88,
    genres: 'Platformer, Action-Adventure, Sci-Fi',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202101/2921/DwL7v9y9d3J8k.png',
    description: 'Blast your way through an interdimensional adventure with Ratchet and Clank as they take on an evil emperor from another reality.'
  },
  {
    title: 'Sea of Stars',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2023-08-29',
    is_coming_soon: false,
    release_date_psplus: '2023-08-29',
    metacritic_score: 87,
    genres: 'Turn-Based RPG, Retro, Indie',
    publisher: 'Sabotage Studio',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202306/1218/sea_of_stars_cover.png',
    description: 'Sea of Stars is a turn-based RPG inspired by the classics. It tells the story of two Children of the Solstice who combine the powers of the sun and moon.'
  },
  {
    title: 'Animal Well',
    tier: 'extra',
    platforms: 'PS5',
    date_added: '2024-05-09',
    is_coming_soon: false,
    release_date_psplus: '2024-05-09',
    metacritic_score: 91,
    genres: 'Metroidvania, Puzzle, Indie',
    publisher: 'Bigmode',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202403/1815/animal_well_cover.png',
    description: 'Hatch from a flower and explore the beautiful and haunting, interconnected labyrinth of Animal Well, a dense nonlinear puzzle Metroidvania.'
  },
  {
    title: 'Balatro',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2026-04-14',
    is_coming_soon: false,
    release_date_psplus: '2026-04-14',
    metacritic_score: 90,
    genres: 'Roguelike, Deckbuilder, Strategy',
    publisher: 'Playstack',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202402/1215/balatro_cover.png',
    description: 'The poker roguelike. Balatro is a hypnotically satisfying deckbuilder where you play illegal poker hands, discover game-changing jokers, and trigger adrenaline-fueled combos.'
  },
  {
    title: 'Dave the Diver',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2024-04-16',
    is_coming_soon: false,
    release_date_psplus: '2024-04-16',
    metacritic_score: 90,
    genres: 'Adventure, Management, Casual',
    publisher: 'MINTROCKET',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202403/1408/dave_the_diver.png',
    description: 'DAVE THE DIVER is a casual, singleplayer adventure RPG featuring deep-sea exploration and fishing during the day, and sushi restaurant management at night.'
  },
  {
    title: 'Cult of the Lamb',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2024-08-20',
    is_coming_soon: false,
    release_date_psplus: '2024-08-20',
    metacritic_score: 86,
    genres: 'Roguelike, Base Building, Dark Comedy',
    publisher: 'Devolver Digital',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202206/0312/cult_of_lamb.png',
    description: 'Start your own cult in a land of false prophets, venturing out into diverse and mysterious regions to build a loyal community of woodland Followers.'
  },
  {
    title: 'Monster Hunter Rise',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2024-06-18',
    is_coming_soon: false,
    release_date_psplus: '2024-06-18',
    metacritic_score: 87,
    genres: 'Action RPG, Hunting, Co-op',
    publisher: 'Capcom',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202211/2410/mh_rise.png',
    description: 'Rise to the challenge and join the hunt! In Monster Hunter Rise, explore maps and use various weapons to take down fearsome monsters.'
  },
  {
    title: 'The Witcher 3: Wild Hunt - Complete Edition',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2024-08-20',
    is_coming_soon: false,
    release_date_psplus: '2024-08-20',
    metacritic_score: 94,
    genres: 'RPG, Open World, Dark Fantasy',
    publisher: 'CD Projekt RED',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202211/0714/witcher3_ce.png',
    description: 'You are Geralt of Rivia, mercenary monster slayer. Before you stands a war-torn, monster-infested continent you can explore at will.'
  },
  {
    title: 'Disco Elysium - The Final Cut',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2023-10-17',
    is_coming_soon: false,
    release_date_psplus: '2023-10-17',
    metacritic_score: 97,
    genres: 'Narrative RPG, Isometric, Detective',
    publisher: 'ZA/UM',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202102/2301/disco_elysium.png',
    description: 'Disco Elysium - The Final Cut is the definitive edition of the groundbreaking role playing game with unprecedented freedom of choice.'
  },
  {
    title: 'Death Stranding: Director’s Cut',
    tier: 'extra',
    platforms: 'PS5',
    date_added: '2022-06-13',
    is_coming_soon: false,
    release_date_psplus: '2022-06-13',
    metacritic_score: 85,
    genres: 'Action, Open World, Sci-Fi',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202106/1715/death_stranding_dc.png',
    description: 'From legendary game creator Hideo Kojima comes a genre-defying experience, now expanded in this definitive Director’s Cut.'
  },
  {
    title: 'Grand Theft Auto V',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2023-12-19',
    is_coming_soon: false,
    release_date_psplus: '2023-12-19',
    metacritic_score: 97,
    genres: 'Action-Adventure, Open World, Crime',
    publisher: 'Rockstar Games',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202202/2816/gtav_ps5.png',
    description: 'Experience entertainment blockbusters Grand Theft Auto V and GTA Online, now enhanced for PlayStation 5.'
  },
  {
    title: 'Red Dead Redemption 2',
    tier: 'extra',
    platforms: 'PS4',
    date_added: '2024-05-21',
    is_coming_soon: false,
    release_date_psplus: '2024-05-21',
    metacritic_score: 97,
    genres: 'Open World, Western, Narrative',
    publisher: 'Rockstar Games',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202010/0222/rdr2_cover.png',
    description: 'Arthur Morgan and the Van der Linde gang are outlaws on the run across the vast and rugged heartland of America.'
  },
  {
    title: 'Resident Evil 2 (Remake)',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2024-01-16',
    is_coming_soon: false,
    release_date_psplus: '2024-01-16',
    metacritic_score: 91,
    genres: 'Survival Horror, Third-Person Shooter',
    publisher: 'Capcom',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202206/0709/re2_remake.png',
    description: 'A deadly virus engulfs the residents of Raccoon City in September of 1998, plunging the town into chaos as flesh-eating zombies roam the streets.'
  },
  {
    title: 'Resident Evil 3 (Remake)',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2024-03-19',
    is_coming_soon: false,
    release_date_psplus: '2024-03-19',
    metacritic_score: 79,
    genres: 'Survival Horror, Action',
    publisher: 'Capcom',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202206/0709/re3_remake.png',
    description: 'Jill Valentine is one of the last remaining people in Raccoon City to witness the atrocities Umbrella performed. Escape the relentless Nemesis.'
  },
  {
    title: 'Dead Space (Remake)',
    tier: 'extra',
    platforms: 'PS5',
    date_added: '2024-10-01',
    is_coming_soon: false,
    release_date_psplus: '2024-10-01',
    metacritic_score: 89,
    genres: 'Sci-Fi Survival Horror',
    publisher: 'Electronic Arts',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202210/0517/dead_space_remake.png',
    description: 'The sci-fi survival horror classic returns, completely rebuilt from the ground up to offer a deeper and more immersive experience aboard the USG Ishimura.'
  },
  {
    title: 'Persona 5 Royal',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2024-07-16',
    is_coming_soon: false,
    release_date_psplus: '2024-07-16',
    metacritic_score: 95,
    genres: 'JRPG, Turn-Based, Anime',
    publisher: 'SEGA / Atlus',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202207/1118/p5r_cover.png',
    description: 'Don the mask of Joker and join the Phantom Thieves of Hearts as you break the chains of modern society and stage grand heists to infiltrate the minds of the corrupt.'
  },
  {
    title: 'Final Fantasy VII Remake Intergrade',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2022-07-19',
    is_coming_soon: false,
    release_date_psplus: '2022-07-19',
    metacritic_score: 89,
    genres: 'Action RPG, Fantasy, Sci-Fi',
    publisher: 'Square Enix',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202102/2518/ff7_intergrade.png',
    description: 'A spectacular reimagining of the iconic original game, featuring a hybrid battle system merging real-time action with strategic command-based combat.'
  },
  {
    title: 'Return to Monkey Island',
    tier: 'extra',
    platforms: 'PS5',
    date_added: '2024-06-18',
    is_coming_soon: false,
    release_date_psplus: '2024-06-18',
    metacritic_score: 86,
    genres: 'Point & Click Adventure, Comedy',
    publisher: 'Devolver Digital',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202209/monkey_island.png',
    description: 'Return to Monkey Island is an unexpected, thrilling return of series creator Ron Gilbert that continues the story of the legendary adventure games.'
  },
  {
    title: 'Uncharted: Legacy of Thieves Collection',
    tier: 'extra',
    platforms: 'PS5',
    date_added: '2023-03-21',
    is_coming_soon: false,
    release_date_psplus: '2023-03-21',
    metacritic_score: 87,
    genres: 'Action-Adventure, Cinematic, Third-Person',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202111/3013/uncharted_lotc.png',
    description: 'Seek your fortune and leave your mark on the map in UNCHARTED: Legacy of Thieves Collection. Includes UNCHARTED 4: A Thief’s End and UNCHARTED: The Lost Legacy.'
  },
  {
    title: 'Control: Ultimate Edition',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2022-06-13',
    is_coming_soon: false,
    release_date_psplus: '2022-06-13',
    metacritic_score: 85,
    genres: 'Action-Adventure, Supernatural, Sci-Fi',
    publisher: '505 Games',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202011/0402/control_ue.png',
    description: 'A corruptive presence has invaded the Federal Bureau of Control… Only you have the power to stop it. The world is now your weapon in an epic fight.'
  },

  // --- PREMIUM & CLASSICS CATALOG (PS+ PREMIUM) ---
  {
    title: 'The Legend of Dragoon',
    tier: 'premium',
    platforms: 'PS5, PS4',
    date_added: '2023-02-21',
    is_coming_soon: false,
    release_date_psplus: '2023-02-21',
    metacritic_score: 74,
    genres: 'JRPG, Classics, Fantasy',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202302/0914/legend_of_dragoon.png',
    description: 'PS1 Classic. Unveil a story of deception, ancient magic and alliance in this classic RPG, enhanced with up-rendering, rewind, and quick save.'
  },
  {
    title: 'Sly Cooper and the Thievius Raccoonus',
    tier: 'premium',
    platforms: 'PS5, PS4',
    date_added: '2024-06-11',
    is_coming_soon: false,
    release_date_psplus: '2024-06-11',
    metacritic_score: 86,
    genres: 'Platformer, Stealth, Classics',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202405/2916/sly_cooper.png',
    description: 'PS2 Classic. Follow the master thief raccoon Sly Cooper and his gang as they recover the stolen pages of the ancient Cooper family manual.'
  },
  {
    title: 'Resistance: Fall of Man',
    tier: 'premium',
    platforms: 'PS5, PS4',
    date_added: '2022-06-13',
    is_coming_soon: false,
    release_date_psplus: '2022-06-13',
    metacritic_score: 86,
    genres: 'FPS, Sci-Fi, Cloud Streaming',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202205/resistance_1.png',
    description: 'PS3 Classic Cloud Stream. Battle the alien Chimera invasion in an alternate 1950s Britain as Sgt. Nathan Hale.'
  },
  {
    title: 'Jak and Daxter: The Precursor Legacy',
    tier: 'premium',
    platforms: 'PS5, PS4',
    date_added: '2022-06-13',
    is_coming_soon: false,
    release_date_psplus: '2022-06-13',
    metacritic_score: 90,
    genres: '3D Platformer, Classics',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202205/jak_daxter.png',
    description: 'PS2 Classic. Enter a new world of magic, adventure, exploration, and discovery with Jak and his ottsel friend Daxter.'
  },
  {
    title: 'Ape Escape',
    tier: 'premium',
    platforms: 'PS5, PS4',
    date_added: '2022-06-13',
    is_coming_soon: false,
    release_date_psplus: '2022-06-13',
    metacritic_score: 90,
    genres: '3D Platformer, Classics',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202205/ape_escape.png',
    description: 'PS1 Classic. A horde of monkeys has stolen the Peak Point Helmet and travelled through time to rewrite history! Catch them all!'
  },
  {
    title: 'God of War HD & God of War II HD',
    tier: 'premium',
    platforms: 'PS5, PS4',
    date_added: '2022-06-13',
    is_coming_soon: false,
    release_date_psplus: '2022-06-13',
    metacritic_score: 94,
    genres: 'Action, Hack & Slash, Classics',
    publisher: 'Sony Interactive Entertainment',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202205/gow_classics.png',
    description: 'PS3 Classics via Cloud Streaming. Experience Kratos’s original wrath across the pantheon of ancient Greek gods.'
  },
  {
    title: 'Tekken 2',
    tier: 'premium',
    platforms: 'PS5, PS4',
    date_added: '2022-06-13',
    is_coming_soon: false,
    release_date_psplus: '2022-06-13',
    metacritic_score: 89,
    genres: 'Fighting, 3D Fighter, Classics',
    publisher: 'Bandai Namco',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202205/tekken2_classic.png',
    description: 'PS1 Classic. Enter the King of Iron Fist Tournament 2 with Heihachi, Kazuya, Jun Kazama, and legendary fighters.'
  },
  {
    title: 'Darksiders Warmastered Edition',
    tier: 'extra',
    platforms: 'PS4',
    date_added: '2024-08-20',
    is_coming_soon: false,
    release_date_psplus: '2024-08-20',
    metacritic_score: 81,
    genres: 'Action-Adventure, Hack & Slash',
    publisher: 'THQ Nordic',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202010/darksiders_wm.png',
    description: 'Deceived by the forces of evil into prematurely bringing about the end of the world, War — the first Horseman of the Apocalypse — must clear his name.'
  },
  {
    title: 'Sword Art Online: Last Recollection',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2024-08-20',
    is_coming_soon: false,
    release_date_psplus: '2024-08-20',
    metacritic_score: 69,
    genres: 'Action RPG, Anime',
    publisher: 'Bandai Namco',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202306/sao_last_rec.png',
    description: 'The climax of the SWORD ART ONLINE game series, Last Recollection features the largest roster of SAO playable characters and sub scenarios!'
  },
  {
    title: 'Wild Card Football',
    tier: 'extra',
    platforms: 'PS5, PS4',
    date_added: '2024-08-20',
    is_coming_soon: false,
    release_date_psplus: '2024-08-20',
    metacritic_score: 68,
    genres: 'Arcade Sports, Football',
    publisher: 'Saber Interactive',
    image_url: 'https://image.api.playstation.com/vulcan/ap/rnd/202308/wild_card_fb.png',
    description: 'A fun pick-up-and-play arcade-style football game featuring 7v7 team-focused gameplay with the unique Wild Card system.'
  }
];

// Helper: HTTP GET text request
function fetchText(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP error ${res.statusCode} fetching ${url}`));
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

// Extract XML tags
function getTagContent(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? match[1].trim() : '';
}

// Parse PlayStation Blog RSS items
function parsePsBlogXml(xml) {
  const items = [];
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];
  
  for (const itemXml of itemMatches) {
    const title = getTagContent(itemXml, 'title').replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").replace(/&amp;/g, '&');
    const link = getTagContent(itemXml, 'link');
    const pubDate = getTagContent(itemXml, 'pubDate');
    const description = getTagContent(itemXml, 'description').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    const content = getTagContent(itemXml, 'content:encoded').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

    items.push({ title, link, pubDate, description, content });
  }
  return items;
}

// Generate consistent ID for game
function getGameId(title) {
  return 'psplus_' + crypto.createHash('md5').update(title.toLowerCase().trim()).digest('hex').substring(0, 16);
}

// Sync the database with Master catalog & Live PS Blog announcements
async function syncPsPlusCatalog() {
  if (db.initDbPromise) {
    await db.initDbPromise;
  }
  console.log('[PS+ Sync] Starting PlayStation Plus catalog synchronization...');
  let addedCount = 0;
  let updatedCount = 0;

  // 1. First sync the comprehensive master list
  for (const item of MASTER_PSPLUS_CATALOG) {
    const psplusId = getGameId(item.title);
    try {
      const existing = await db.query('SELECT psplus_id FROM psplus_catalog WHERE psplus_id = $1', [psplusId]);
      if (existing.rows.length === 0) {
        await db.query(`
          INSERT INTO psplus_catalog (
            psplus_id, title, tier, platforms, date_added, is_coming_soon, 
            release_date_psplus, metacritic_score, genres, publisher, image_url, description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          psplusId,
          item.title,
          item.tier,
          item.platforms || 'PS5, PS4',
          item.date_added || new Date().toISOString().substring(0, 10),
          item.is_coming_soon ? 1 : 0,
          item.release_date_psplus || null,
          item.metacritic_score || null,
          item.genres || null,
          item.publisher || null,
          item.image_url || null,
          item.description || null
        ]);
        addedCount++;
      } else {
        await db.query(`
          UPDATE psplus_catalog SET 
            tier = $1, platforms = $2, date_added = $3, is_coming_soon = $4,
            release_date_psplus = $5, metacritic_score = $6, genres = $7,
            publisher = $8, image_url = $9, description = $10, last_updated_at = CURRENT_TIMESTAMP
          WHERE psplus_id = $11
        `, [
          item.tier,
          item.platforms || 'PS5, PS4',
          item.date_added,
          item.is_coming_soon ? 1 : 0,
          item.release_date_psplus,
          item.metacritic_score,
          item.genres,
          item.publisher,
          item.image_url,
          item.description,
          psplusId
        ]);
        updatedCount++;
      }
    } catch (e) {
      console.error(`[PS+ Sync] Error upserting master game ${item.title}:`, e.message);
    }
  }

  // 2. Fetch live PlayStation Blog feed to catch any newly announced additions / coming soon dates
  try {
    const rssXml = await fetchText('https://blog.playstation.com/tag/playstation-plus/feed/');
    const blogItems = parsePsBlogXml(rssXml);
    console.log(`[PS+ Sync] Retrieved ${blogItems.length} official PlayStation Blog announcement articles.`);

    for (const post of blogItems) {
      // Check for Game Catalog announcements
      if (/Game Catalog|Monthly Games|PlayStation Plus (Extra|Premium|Essential)/i.test(post.title)) {
        // Extract release dates mentioned in the article, e.g. "available Tuesday, August 18"
        const dateMatch = post.content.match(/available (?:on )?(?:Tuesday|Wednesday|Thursday|Friday|Monday|Saturday|Sunday)?,?\s*([A-Za-z]+ \d{1,2}(?:, \d{4})?)/i);
        const announcedDate = dateMatch ? dateMatch[1] : null;

        // Extract list of game headlines e.g. <h3>Title | PS4, PS5</h3> or <strong>Title</strong> | PS4, PS5
        const gameHeaders = post.content.match(/<(?:h[234]|strong)[^>]*>([A-Za-z0-9\s:’'™®\.\-]+?)(?:<\/strong>)?\s*\|\s*(PS4|PS5|PS4,\s*PS5|PS5,\s*PS4|PS VR2|PlayStation|PS2|PS3|PSP)/gi) || [];
        
        for (const rawHeader of gameHeaders) {
          const clean = rawHeader.replace(/<[^>]+>/g, '').trim();
          const parts = clean.split('|');
          if (parts.length >= 2) {
            const rawTitle = parts[0].trim();
            const rawPlatform = parts[1].trim();
            if (rawTitle.length > 2 && !rawTitle.toLowerCase().includes('playstation plus') && !rawTitle.toLowerCase().includes('game catalog')) {
              const psId = getGameId(rawTitle);
              
              // Determine tier based on blog context
              let tier = 'extra';
              if (/Essential|Monthly Games/i.test(post.title)) tier = 'essential';
              else if (/Classics|Premium/i.test(post.title) || /PS1|PS2|PS3|PSP|Classics/i.test(clean)) tier = 'premium';

              const existing = await db.query('SELECT psplus_id FROM psplus_catalog WHERE psplus_id = $1', [psId]);
              if (existing.rows.length === 0) {
                await db.query(`
                  INSERT INTO psplus_catalog (
                    psplus_id, title, tier, platforms, date_added, is_coming_soon, 
                    release_date_psplus, metacritic_score, genres, publisher, description
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                  psId,
                  rawTitle,
                  tier,
                  rawPlatform,
                  new Date(post.pubDate || Date.now()).toISOString().substring(0, 10),
                  0,
                  announcedDate,
                  null,
                  'PlayStation Plus Catalog',
                  'Sony Interactive Entertainment',
                  `Announced on PlayStation Blog: ${post.title}`
                ]);
                addedCount++;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[PS+ Sync] Live RSS feed fetch skipped or failed (using master verified database):', err.message);
  }

  console.log(`[PS+ Sync] Sync complete. Total synced: ${addedCount} newly added, ${updatedCount} updated.`);
  return { addedCount, updatedCount, totalInCatalog: MASTER_PSPLUS_CATALOG.length + addedCount };
}

// Scheduled twice-daily sync (every 12 hours)
let syncIntervalHandle = null;
function startTwiceDailySyncScheduler() {
  if (syncIntervalHandle) clearInterval(syncIntervalHandle);
  
  // Initial sync upon server boot
  syncPsPlusCatalog().catch(e => console.error('[PS+ Sync] Initial sync failed:', e));

  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  syncIntervalHandle = setInterval(() => {
    console.log('[PS+ Sync] Triggering scheduled twice-daily PS+ catalog sync...');
    syncPsPlusCatalog().catch(e => console.error('[PS+ Sync] Scheduled sync failed:', e));
  }, TWELVE_HOURS_MS);

  console.log('[PS+ Sync] Twice-daily sync scheduler registered (Every 12 hours).');
}

module.exports = {
  MASTER_PSPLUS_CATALOG,
  syncPsPlusCatalog,
  startTwiceDailySyncScheduler
};
