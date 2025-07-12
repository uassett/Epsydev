# Fortnite Chapter 2 Season 5 Asset Guide

## Season Overview
Chapter 2 Season 5 ran from December 2, 2020, to March 16, 2021 (Game versions 15.00 - 15.50). This season introduced several major features and changes to the Fortnite landscape.

## Key Features of Season 5

### 1. The Zero Point and Reality Rifts
- The Zero Point became destabilized, creating rifts to other realities
- This brought characters from various franchises into Fortnite
- Map changes included desert biomes and other reality-influenced areas

### 2. Gold Bars Currency System
- New in-game currency system
- Used for hiring NPCs, buying weapons, and completing bounties
- Stored in-game and persisted across matches

### 3. Bounty System
- Players could place bounties on other players
- NPCs would offer bounty contracts
- Reward system tied to Gold Bars

### 4. NPC Characters
- **Mando** (The Mandalorian) - Razor Crest crash site
- **Mancake** - Butter Barn
- **Kondor** - Multiple locations
- **Lexa** - Hunter's Haven
- **Reese** - Dirty Docks

### 5. Exotic Weapons
- **Mandalorian's Rifle** - Purchased from Mando
- **Boom Sniper Rifle** - Splode's exotic weapon
- **Dragon's Breath Shotgun** - Blaze's exotic weapon
- **Shadow Tracker** - Reese's exotic weapon
- **Hop Rock Dualies** - Obtained from Deadfire

## Important File Locations

### Character Assets
```
FortniteGame/Content/Characters/
├── Player/
│   ├── Mando/
│   ├── Mancake/
│   ├── Kondor/
│   ├── Lexa/
│   └── Reese/
└── NPCs/
    ├── Season5NPCs/
    └── BountyTargets/
```

### Weapon Assets
```
FortniteGame/Content/Weapons/
├── Exotic/
│   ├── MandalorianRifle/
│   ├── BoomSniper/
│   ├── DragonBreath/
│   ├── ShadowTracker/
│   └── HopRockDualies/
└── Regular/
    ├── Crafted/
    └── Upgraded/
```

### Map Assets
```
FortniteGame/Content/Athena/Maps/
├── Season5/
│   ├── DesertBiome/
│   ├── ButterBarn/
│   ├── Colosseum/
│   ├── StealthyStronghold/
│   └── CrashedShips/
└── ZeroPoint/
    ├── Rifts/
    └── StabilityEffects/
```

### UI Assets
```
FortniteGame/Content/UI/
├── Season5/
│   ├── BountySystem/
│   ├── GoldBars/
│   ├── NPCInteraction/
│   └── ExoticWeapons/
└── BattlePass/
    └── Season15/
```

## Asset Extraction Priority

### High Priority (Core Season 5 content)
1. **Battle Pass Characters** - Mando, Mancake, Kondor, Lexa, Reese
2. **Exotic Weapons** - All 5 exotic weapons and their animations
3. **Map Changes** - Desert biome, new POIs
4. **Gold Bars System** - UI, mechanics, storage
5. **NPC System** - Dialogue, interactions, AI

### Medium Priority (Supporting content)
1. **Crafting System** - Recipes, materials, UI
2. **Bounty System** - Contracts, rewards, tracking
3. **Audio** - Season 5 music, sound effects
4. **Emotes** - Season 5 specific emotes
5. **Loading Screens** - Season 5 artwork

### Low Priority (General content)
1. **Item Shop** - Weekly rotations
2. **Challenges** - Week-specific challenges
3. **Patches** - Minor updates and fixes

## File Naming Conventions

### PAK Files
- `pakchunk0-WindowsClient.pak` - Core game files
- `pakchunk1-WindowsClient.pak` - Map data
- `pakchunk10-WindowsClient.pak` - Season 5 specific content
- `pakchunk11-WindowsClient.pak` - Additional Season 5 content

### Asset Files
- Characters: `CID_XXX_Athena_Commando_*`
- Weapons: `WID_XXX_*` or `Weapon_*`
- Emotes: `EID_XXX_*`
- Gliders: `Glider_ID_XXX_*`
- Pickaxes: `Pickaxe_ID_XXX_*`

## Extraction Tips

### Using FModel
1. Set game directory to Season 5 build
2. Load PAK files in order (0, 1, 10, 11)
3. Use the search function to find specific assets
4. Export as .png for textures, .psk for models

### Using Custom Tools
1. Use the provided Python scripts for batch extraction
2. C++ tools for performance-critical operations
3. Filter by Season 5 specific paths

### Common Issues
- **Encryption**: Some files may be encrypted
- **Dependencies**: Assets may reference other files
- **Versions**: Ensure compatibility with v15.xx builds
- **Size**: Season 5 assets are quite large

## Development Notes

### File Formats
- **.uasset**: Unreal Engine assets
- **.umap**: Map files
- **.pak**: Archive files
- **.ucas/.utoc**: Container files (newer format)

### Version Compatibility
- Game versions: 15.00 through 15.50
- Engine: Unreal Engine 4.26
- Platform: Cross-platform compatibility needed

## Useful Resources

### Official References
- Fortnite Wiki Season 5 page
- Epic Games developer documentation
- Unreal Engine 4.26 documentation

### Community Tools
- FModel - Asset viewer and extractor
- UModel - 3D model extractor
- Fortnite-API - Game data API

### Discord Communities
- OGFN Discord: https://discord.gg/TCpKNe8h
- Fortnite Modding communities
- Unreal Engine modding groups