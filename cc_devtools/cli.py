import os

def path_cmd():
    ext_dir = os.path.join(os.path.dirname(__file__), "extension")
    print(ext_dir)
