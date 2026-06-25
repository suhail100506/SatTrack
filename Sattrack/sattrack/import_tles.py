import os
import json
import pymongo
from pymongo import UpdateOne
import certifi

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")

def parse_tle_file(filepath):
    satellites = []
    # Read files with utf-8 or ignore errors to prevent crashes on non-utf-8 characters in satellite names
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = [line.strip() for line in f.readlines() if line.strip()]
    
    i = 0
    while i < len(lines):
        # A valid TLE set:
        # Line i: Name
        # Line i+1: Line 1 (starts with '1 ')
        # Line i+2: Line 2 (starts with '2 ')
        if i + 2 < len(lines):
            name = lines[i]
            l1 = lines[i+1]
            l2 = lines[i+2]
            if l1.startswith('1 ') and l2.startswith('2 '):
                satellites.append({
                    "name": name,
                    "line1": l1,
                    "line2": l2
                })
                i += 3
                continue
        i += 1
    return satellites

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    tle_dir = os.path.join(base_dir, "TLEs")
    
    if not os.path.exists(tle_dir):
        print(f"TLEs directory not found at: {tle_dir}")
        print("Skipping import. Please create a 'TLEs' directory in the project root and place Celestrak .txt files there if you want to import fresh data.")
        return
        
    txt_files = [f for f in os.listdir(tle_dir) if f.endswith(".txt")]
    print(f"Found {len(txt_files)} TLE files in {tle_dir}")
    
    all_sats = {}
    for filename in txt_files:
        path = os.path.join(tle_dir, filename)
        try:
            sats = parse_tle_file(path)
            print(f"Parsed {len(sats)} satellites from {filename}")
            for sat in sats:
                # Store in a dict keyed by name to deduplicate
                all_sats[sat["name"]] = sat
        except Exception as e:
            print(f"Error parsing {filename}: {e}")
            
    print(f"Total unique satellites parsed: {len(all_sats)}")
    
    if not all_sats:
        print("No satellites parsed. Exiting.")
        return

    # 1. Save locally as fallback cache JSON file
    local_json_path = os.path.join(os.path.dirname(__file__), "local_tles.json")
    try:
        with open(local_json_path, "w", encoding="utf-8") as f:
            json.dump(list(all_sats.values()), f, indent=2)
        print(f"Successfully saved {len(all_sats)} satellites to local fallback cache: {local_json_path}")
    except Exception as e:
        print(f"Warning: Failed to save local fallback cache: {e}")

    # 2. Try uploading to MongoDB Atlas
    try:
        if "mongodb+srv" in MONGO_URI or "ssl=true" in MONGO_URI.lower() or "tls=true" in MONGO_URI.lower():
            print("Connecting to remote MongoDB with TLS...")
            client = pymongo.MongoClient(MONGO_URI, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000)
        else:
            print("Connecting to local/community MongoDB...")
            client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client["sattrack"]
        sat_col = db["satellites"]
        
        # Test connection
        client.admin.command('ping')
        
        operations = []
        for name, sat in all_sats.items():
            operations.append(
                UpdateOne(
                    {"name": name},
                    {"$set": {"name": name, "line1": sat["line1"], "line2": sat["line2"]}},
                    upsert=True
                )
            )
            
        print(f"Executing bulk write to MongoDB ({len(operations)} operations)...")
        res = sat_col.bulk_write(operations)
        print(f"Bulk write completed successfully. Matched: {res.matched_count}, Upserted: {res.upserted_count}, Modified: {res.modified_count}")
    except Exception as e:
        print("\n" + "="*80)
        print("MONGODB UPLOAD FAILED")
        print("="*80)
        print(f"Error details: {e}")
        print("\nThis usually happens because your current IP is not whitelisted on MongoDB Atlas.")
        print("Please whitelist your current public IP in the MongoDB Atlas dashboard:")
        print(" -> IP Address: 49.128.109.157")
        print("="*80 + "\n")

if __name__ == "__main__":
    main()
