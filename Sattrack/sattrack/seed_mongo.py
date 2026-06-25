import os
import json
import pymongo
from pymongo import UpdateOne
import dotenv

# Load environment variables
dotenv.load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")

def main():
    # Find local_tles.json relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, "local_tles.json")
    
    if not os.path.exists(json_path):
        print(f"Error: Cache file not found at {json_path}")
        return
        
    print(f"Reading satellite TLEs from cache: {json_path}")
    with open(json_path, "r", encoding="utf-8") as f:
        satellites = json.load(f)
        
    print(f"Loaded {len(satellites)} satellites.")
    
    try:
        print(f"Connecting to MongoDB: {MONGO_URI}")
        if "mongodb+srv" in MONGO_URI or "ssl=true" in MONGO_URI.lower() or "tls=true" in MONGO_URI.lower():
            import certifi
            client = pymongo.MongoClient(MONGO_URI, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000)
        else:
            client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            
        db = client["sattrack"]
        sat_col = db["satellites"]
        
        # Test connection
        client.admin.command('ping')
        print("Connected to MongoDB successfully!")
        
        operations = []
        for sat in satellites:
            operations.append(
                UpdateOne(
                    {"name": sat["name"]},
                    {"$set": {"name": sat["name"], "line1": sat["line1"], "line2": sat["line2"]}},
                    upsert=True
                )
            )
            
        print(f"Bulk writing {len(operations)} satellites to MongoDB collection 'satellites'...")
        res = sat_col.bulk_write(operations)
        print(f"Bulk write complete. Matched: {res.matched_count}, Upserted: {res.upserted_count}, Modified: {res.modified_count}")
        print("Database 'sattrack' and collection 'satellites' are now successfully created and populated!")
        
    except Exception as e:
        print(f"MongoDB connection failed: {e}")

if __name__ == '__main__':
    main()
