#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <memory>

namespace Fortnite {
namespace Chapter2Season5 {

// PAK file structures
struct PakHeader {
    uint32_t magic;           // 'PAK\0'
    uint32_t version;         // PAK version
    uint64_t index_offset;    // Offset to file index
    uint64_t index_size;      // Size of file index
    uint8_t sha1[20];         // SHA1 hash of index
    uint8_t encrypted;        // Encryption flag
    uint32_t compression;     // Compression method
};

struct PakFileEntry {
    uint64_t offset;          // File offset in PAK
    uint64_t size;            // Compressed size
    uint64_t uncompressed_size; // Uncompressed size
    uint32_t compression_method; // Compression method
    uint8_t sha1[20];         // File SHA1 hash
    uint8_t encrypted;        // Encryption flag
    uint32_t compression_blocks_count; // Number of compression blocks
    std::string filename;     // File path
};

// Unreal Engine 4 asset structures (used in Chapter 2 Season 5)
struct UE4AssetHeader {
    uint32_t magic;           // Unreal magic number
    uint32_t version;         // Asset version
    uint64_t header_size;     // Header size
    std::string package_name; // Package name
    uint32_t package_flags;   // Package flags
    uint32_t name_count;      // Number of names
    uint32_t name_offset;     // Offset to names
    uint32_t export_count;    // Number of exports
    uint32_t export_offset;   // Offset to exports
    uint32_t import_count;    // Number of imports
    uint32_t import_offset;   // Offset to imports
};

// Chapter 2 Season 5 specific structures
struct Season5Character {
    std::string character_id;
    std::string display_name;
    std::string rarity;
    std::string set_name;
    std::vector<std::string> styles;
    bool is_battle_pass;
    uint32_t tier;
};

struct Season5Weapon {
    std::string weapon_id;
    std::string display_name;
    std::string weapon_type;
    bool is_exotic;
    uint32_t damage;
    uint32_t fire_rate;
    uint32_t magazine_size;
    std::string rarity;
};

struct Season5Location {
    std::string location_id;
    std::string display_name;
    float x, y, z;            // World coordinates
    std::string biome_type;   // Desert, Swamp, etc.
    bool is_named_location;
    std::vector<std::string> associated_npcs;
};

// Season 5 specific items
struct GoldBar {
    uint32_t amount;
    std::string source;       // How it was obtained
};

struct BountyItem {
    std::string target_player;
    uint32_t reward_amount;
    float time_remaining;
    std::string issuer;
};

// Asset extraction and management
class FortniteAssetReader {
public:
    FortniteAssetReader();
    ~FortniteAssetReader();
    
    // PAK file operations
    bool OpenPakFile(const std::string& pak_path);
    bool ReadPakHeader(PakHeader& header);
    std::vector<PakFileEntry> GetFileList();
    bool ExtractFile(const std::string& file_path, const std::string& output_path);
    
    // Asset specific operations
    std::vector<Season5Character> GetSeason5Characters();
    std::vector<Season5Weapon> GetSeason5Weapons();
    std::vector<Season5Location> GetSeason5Locations();
    
    // Utility functions
    bool IsValidPakFile(const std::string& pak_path);
    std::string GetAssetType(const std::string& file_path);
    bool DecryptFile(const std::vector<uint8_t>& encrypted_data, std::vector<uint8_t>& decrypted_data);
    
private:
    std::unique_ptr<class PakFileImpl> m_impl;
};

// Chapter 2 Season 5 specific constants
namespace Constants {
    constexpr uint32_t SEASON5_VERSION_MIN = 1500;  // v15.00
    constexpr uint32_t SEASON5_VERSION_MAX = 1550;  // v15.50
    
    // Important file paths for Season 5
    constexpr const char* CHARACTERS_PATH = "FortniteGame/Content/Characters/";
    constexpr const char* WEAPONS_PATH = "FortniteGame/Content/Weapons/";
    constexpr const char* MAPS_PATH = "FortniteGame/Content/Athena/Maps/";
    constexpr const char* ITEMS_PATH = "FortniteGame/Content/Items/";
    constexpr const char* UI_PATH = "FortniteGame/Content/UI/";
    
    // Season 5 specific NPCs
    constexpr const char* SEASON5_NPCS[] = {
        "Mando", "Mancake", "Kondor", "Lexa", "Reese"
    };
    
    // Season 5 exotic weapons
    constexpr const char* EXOTIC_WEAPONS[] = {
        "Mandalorian_Rifle", "Boom_Sniper", "Dragons_Breath", 
        "Shadow_Tracker", "Hop_Rock_Dualies"
    };
}

} // namespace Chapter2Season5
} // namespace Fortnite