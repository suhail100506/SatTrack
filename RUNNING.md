# How to Run SatTrack

---

## Backend (Python / Flask)

**1. Activate the virtual environment**
powershell
python venv venv
venv\Scripts\activate


**2. Install dependencies** 
powershell
pip install flask skyfield numpy


**3. Start the server**
powershell
cd Sattrack
python api.py


Server runs at: `http://0.0.0.0:5005`

**Test it:**

http://localhost:5005/satellites?lat=13.0827&lon=77.5877




## Frontend (React Native / Expo)

*

**1. Install dependencies** 
powershell
cd sattrack-mobile
npm install


**2. Start the app**
powershell
npx expo start


| Device | Action |
|--------|--------|
| Physical phone | Install **Expo Go** → scan the QR code |
| Android Emulator | Press `a` in the terminal |
| iOS Simulator | Press `i` in the terminal |

> ⚠️ Phone and PC must be on the **same Wi-Fi network**.



## Startup Checklist


[ ] venv\Scripts\activate
[ ] pip install flask skyfield numpy
[ ] update API_BASE_URL with your PC's IP
[ ] python api.py              ← keep this terminal open
[ ] cd sattrack-mobile
[ ] npm install
[ ] npx expo start
[ ] grant location permission in the app

