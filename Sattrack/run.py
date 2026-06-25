import os
import dotenv

# Load environment variables from .env if present
dotenv.load_dotenv()

from sattrack import app

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5002))
    app.run(host='0.0.0.0', port=port, debug=True)
