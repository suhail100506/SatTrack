# SatTrack — Running & Deployment Guide

This project consists of a React Native mobile client (Expo) and a Python Flask backend API connecting to a MongoDB database (Atlas or local Community Server).

---

## 1. Backend (Python / Flask / MongoDB)

### Prerequisite: MongoDB
Ensure your local MongoDB Community Server is running on port `27017` (default) or you have set up a remote MongoDB Atlas URI.

### Step-by-Step Setup:
1. **Activate the Virtual Environment:**
   ```powershell
   # In Windows PowerShell (from root workspace):
   .\venv\Scripts\activate
   ```
2. **Install Dependencies:**
   ```powershell
   cd Sattrack
   pip install -r requirements.txt
   ```
3. **Configure Environment Variables:**
   * Create a `.env` file in the `Sattrack/` folder matching `Sattrack/.env.example`.
4. **Seed the database (Import TLEs):**
   ```powershell
   python sattrack/import_tles.py
   ```
5. **Start the API Server:**
   ```powershell
   python run.py
   ```
   * The server runs at `http://0.0.0.0:5002` by default.
   * **Web Dashboard:** Open `http://localhost:5002` in your browser to view the interactive tracking dashboard.
   * **API Test:** Open `http://localhost:5002/satellites?lat=13.0827&lon=77.5877` in your browser to check raw satellite positions.

---

## 2. Frontend (React Native / Expo / Mobile)

### Step-by-Step Setup:
1. **Install Dependencies:**
   ```powershell
   cd sattrack-mobile
   npm install
   ```
2. **Configure Environment Variables:**
   * Create a `.env` file in the `sattrack-mobile/` folder with your server's IP address:
     ```text
     EXPO_PUBLIC_API_BASE_URL=http://<YOUR_SERVER_IP>:5002
     ```
3. **Start the App:**
   ```powershell
   npx expo start
   ```

### Running on Devices:
| Device | Action |
|---|---|
| **Physical Phone** | Install **Expo Go** on Android/iOS, and scan the QR code printed in the terminal. |
| **Android Emulator** | Press `a` in the terminal. |
| **iOS Simulator** | Press `i` in the terminal. |

---

## 3. Remote Server Deployment (using Nohup)

To run the backend continuously on a remote Linux server (e.g., `quasar6g`):
1. **Upload the project source zip archive:**
   ```powershell
   scp sattrack-project.zip intern1@quasar6g:/home/intern1/
   ```
2. **Extract and start on server:**
   ```bash
   ssh intern1@quasar6g
   unzip -o ~/sattrack-project.zip -d ~/sattrack-project
   cd ~/sattrack-project/Sattrack
   source venv/bin/activate
   pip install -r requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org
   python3 sattrack/import_tles.py
   nohup python3 run.py > api.log 2>&1 &
   ```
