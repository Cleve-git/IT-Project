import os
import sys

# 1. Dapatkan path folder 'api' dan folder 'api/app'
api_dir = os.path.dirname(__file__)
app_dir = os.path.join(api_dir, "app")

# 2. Masukkan KEDUA folder tersebut ke dalam sys.path Python
sys.path.insert(0, api_dir)
sys.path.insert(0, app_dir)

from app.main import app
