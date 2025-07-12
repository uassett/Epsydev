# Fortnite Chapter 2 Season 5 Project Structure

## Recommended Directory Structure

```
fortnite-ch2s5/
├── assets/
│   ├── game_files/          # Original Fortnite files
│   ├── extracted/           # Extracted assets
│   ├── textures/           # Texture files
│   ├── models/             # 3D models
│   ├── audio/              # Audio files
│   └── maps/               # Map data
├── tools/
│   ├── extractors/         # File extraction tools
│   ├── converters/         # Format conversion tools
│   └── utils/              # Utility scripts
├── src/
│   ├── cpp/                # C++ source files
│   ├── csharp/             # C# source files
│   ├── python/             # Python scripts
│   └── dart/               # Dart source files
├── docs/
│   ├── file_formats.md     # Documentation on file formats
│   ├── api_reference.md    # API documentation
│   └── usage_guide.md      # Usage instructions
├── build/                  # Build outputs
├── tests/                  # Test files
└── config/                 # Configuration files
```

## Chapter 2 Season 5 Specific Notes

### Key Game Files to Work With:
- **pak files**: Main asset containers
- **ucas/utoc files**: Unreal Engine 4 asset files
- **bin files**: Binary data files
- **json files**: Configuration and metadata

### Important Asset Categories:
- **Characters**: Battle pass skins, NPCs
- **Weapons**: Exotic weapons, crafting materials
- **Map**: Desert biome, Butter Barn, etc.
- **Items**: Gold bars, bounty system items
- **Vehicles**: Cars, boats from the season

### File Extraction Tools Needed:
- FModel (for viewing/extracting assets)
- UE4 tools for pak file extraction
- Custom extractors for specific formats

## Development Languages

### C++ (Performance-critical operations)
- File parsing and extraction
- Asset processing
- Memory management for large files

### C# (Windows integration, tools)
- GUI applications for asset management
- File format converters
- Asset viewers

### Python (Scripting, automation)
- Batch processing scripts
- Data analysis of game files
- Quick prototyping

### Dart (Cross-platform tools)
- Mobile tools for asset viewing
- Web-based asset browsers
- Cross-platform utilities