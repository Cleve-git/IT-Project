import os
import sys

# Ensure frontend/api directory is in python search path for importing app module
sys.path.insert(0, os.path.dirname(__file__))

from app.main import app
