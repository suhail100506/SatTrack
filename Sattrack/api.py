import pymongo
from flask import Flask, jsonify, request
from visibility import SatelliteVisibilityEngine, SatelliteRecord
from sample_tles import build_sample_satellites
import certifi

app = Flask(__name__)

# Connect to MongoDB
import os
import json

MONGO_URI = "mongodb+srv://mohammedsuhail100506:mongo10@cluster0.zjpg81g.mongodb.net/"
mongo_fallback = False

try:
    print("Connecting to MongoDB Atlas...")
    client = pymongo.MongoClient(MONGO_URI, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=3000)
    db = client["sattrack"]
    sat_col = db["satellites"]
    # Test connection
    client.admin.command('ping')
    print("Successfully connected to MongoDB Atlas!")
    
    # Auto-seed the database if it is empty
    if sat_col.count_documents({}) == 0:
        print("MongoDB 'satellites' collection is empty. Seeding defaults...")
        sample_sats = build_sample_satellites()
        seed_docs = [
            {"name": sat.name, "line1": sat.line1, "line2": sat.line2}
            for sat in sample_sats
        ]
        sat_col.insert_many(seed_docs)
        print("Database seeded with sample satellites.")
except Exception as e:
    print(f"MongoDB connection failed: {e}. Falling back to local TLE store.")
    mongo_fallback = True

def load_satellites(search_query=""):
    records = []
    
    # Try MongoDB first
    if not mongo_fallback:
        try:
            query = {}
            if search_query:
                query["name"] = {"$regex": search_query, "$options": "i"}
                db_sats = list(sat_col.find(query).limit(100))
            else:
                db_sats = list(sat_col.find(query).limit(50))
                
            for doc in db_sats:
                records.append(SatelliteRecord(name=doc["name"], line1=doc["line1"], line2=doc["line2"]))
            if records:
                return records
        except Exception as e:
            print(f"MongoDB fetch failed: {e}. Falling back to local TLE store.")
            
    # Fallback to local_tles.json
    local_json_path = os.path.join(os.path.dirname(__file__), "local_tles.json")
    if os.path.exists(local_json_path):
        try:
            with open(local_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            count = 0
            for item in data:
                name = item["name"]
                if search_query:
                    if search_query.lower() in name.lower():
                        records.append(SatelliteRecord(name=name, line1=item["line1"], line2=item["line2"]))
                        count += 1
                        if count >= 100:
                            break
                else:
                    records.append(SatelliteRecord(name=name, line1=item["line1"], line2=item["line2"]))
                    count += 1
                    if count >= 50:
                        break
            return records
        except Exception as e:
            print(f"Failed to read local fallback cache: {e}")

    # Ultimate fallback: default sample satellites
    print("Falling back to default sample satellites.")
    sample_sats = build_sample_satellites()
    for sat in sample_sats:
        if search_query and search_query.lower() not in sat.name.lower():
            continue
        records.append(SatelliteRecord(name=sat.name, line1=sat.line1, line2=sat.line2))
    return records

@app.route('/satellites', methods=['GET'])
def get_satellites():
    lat = float(request.args.get('lat', 13.0827))
    lon = float(request.args.get('lon', 77.5877))
    search = request.args.get('search', '').strip()
    limit = int(request.args.get('limit', 50))
    
    # Load dynamic TLEs
    records = load_satellites(search)
    
    tle_map = {rec.name: (rec.line1, rec.line2) for rec in records}
    
    if not records:
        return jsonify({"satellites": [], "location": {"lat": lat, "lon": lon}})
        
    engine = SatelliteVisibilityEngine(records, min_elevation_deg=10.0)
    results = engine.best_satellites(lat, lon, top_n=limit)
    
    output = []
    for r in results:
        sat_name = str(r.satellite)
        tle_line1, tle_line2 = tle_map.get(sat_name, (None, None))
        output.append({
            "name": sat_name,
            "tle_line1": tle_line1,
            "tle_line2": tle_line2,
            "visible": bool(r.visible),
            "elevation_deg": float(round(r.elevation_deg, 2)),
            "azimuth_deg": float(round(r.azimuth_deg, 2)) if r.azimuth_deg is not None else None,
            "range_km": float(round(r.range_km, 1)) if r.range_km is not None else None,
            "sub_point_lat": float(round(r.sub_point_lat, 4)) if r.sub_point_lat is not None else None,
            "sub_point_lon": float(round(r.sub_point_lon, 4)) if r.sub_point_lon is not None else None,
            "sat_altitude_km": float(round(r.sat_altitude_km, 1)) if r.sat_altitude_km is not None else None,
            "visible_until_utc": str(r.visible_until_utc) if r.visible_until_utc else None,
            "visible_for_minutes": float(round(r.visible_for_minutes, 1)) if r.visible_for_minutes is not None else None,
            "next_visible_at_utc": str(r.next_visible_at_utc) if r.next_visible_at_utc else None,
            "next_visible_duration_minutes": float(round(r.next_visible_duration_minutes, 1)) if r.next_visible_duration_minutes is not None else None,
            "nearest_point_lat": float(round(r.nearest_point_lat, 4)) if r.nearest_point_lat is not None else None,
            "nearest_point_lon": float(round(r.nearest_point_lon, 4)) if r.nearest_point_lon is not None else None,
            "distance_to_nearest_point_km": float(round(r.distance_to_nearest_point_km, 1)) if r.distance_to_nearest_point_km is not None else None,
            "no_pass_in_horizon": bool(r.no_pass_in_horizon),
            "current_time_utc": str(r.current_time_utc),
        })
    return jsonify({"satellites": output, "location": {"lat": lat, "lon": lon}})

@app.route('/satellites/manage', methods=['POST'])
def manage_satellite():
    data = request.json
    if not data or not data.get("name") or not data.get("line1") or not data.get("line2"):
        return jsonify({"error": "Missing required fields: name, line1, line2"}), 400
    
    name = data["name"].strip()
    line1 = data["line1"].strip()
    line2 = data["line2"].strip()
    
    # Save to local fallback cache JSON
    local_json_path = os.path.join(os.path.dirname(__file__), "local_tles.json")
    try:
        local_sats = []
        if os.path.exists(local_json_path):
            with open(local_json_path, "r", encoding="utf-8") as f:
                local_sats = json.load(f)
        
        # Remove if already exists, then append
        local_sats = [s for s in local_sats if s["name"] != name]
        local_sats.append({"name": name, "line1": line1, "line2": line2})
        with open(local_json_path, "w", encoding="utf-8") as f:
            json.dump(local_sats, f, indent=2)
    except Exception as e:
        print(f"Warning: Failed to update local fallback cache: {e}")

    if not mongo_fallback:
        try:
            # Upsert satellite TLE configuration in MongoDB
            sat_col.update_one(
                {"name": name},
                {"$set": {"name": name, "line1": line1, "line2": line2}},
                upsert=True
            )
            return jsonify({"status": "success", "message": f"Satellite '{name}' added/updated in MongoDB & local cache successfully."})
        except Exception as e:
            print(f"MongoDB update failed: {e}")
            
    return jsonify({"status": "success", "message": f"Satellite '{name}' added/updated in local fallback cache."})

@app.route('/satellites/manage/<name>', methods=['DELETE'])
def delete_satellite(name):
    deleted_local = False
    local_json_path = os.path.join(os.path.dirname(__file__), "local_tles.json")
    try:
        if os.path.exists(local_json_path):
            with open(local_json_path, "r", encoding="utf-8") as f:
                local_sats = json.load(f)
            orig_len = len(local_sats)
            local_sats = [s for s in local_sats if s["name"] != name]
            if len(local_sats) < orig_len:
                deleted_local = True
                with open(local_json_path, "w", encoding="utf-8") as f:
                    json.dump(local_sats, f, indent=2)
    except Exception as e:
        print(f"Warning: Failed to delete from local fallback cache: {e}")

    deleted_mongo = False
    if not mongo_fallback:
        try:
            res = sat_col.delete_one({"name": name})
            if res.deleted_count > 0:
                deleted_mongo = True
        except Exception as e:
            print(f"MongoDB delete failed: {e}")

    if deleted_mongo or deleted_local:
        return jsonify({"status": "success", "message": f"Satellite '{name}' deleted successfully."})
    else:
        return jsonify({"error": f"Satellite '{name}' not found."}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5005, debug=True)
