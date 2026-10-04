import os
import sys

# The backend package lives where Decky puts it on the import path.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "py_modules"))
