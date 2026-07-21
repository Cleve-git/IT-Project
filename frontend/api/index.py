import os
import sys

# 1. Daftarkan folder 'frontend/api' DAN 'frontend/api/app' ke sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.join(current_dir, "app")

if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

# 2. Import FastAPI app dari app.main
try:
    from app.main import app
except ImportError:
    # Fallback import jika sys.path langsung merujuk ke dalam folder app
    from main import app

# 3. Expose handler untuk Vercel Serverless
app = app
