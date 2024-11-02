# generate_directory_tree.py

import os

# Define the root directory
ROOT_DIR = os.getcwd()  # Current working directory

# Define exclusions
excluded_dirs = {"vzeda", "__pycache__", "node_modules", "media", "object", ".git", ".next"}
excluded_files = {".pyc", ".log", ".sqlite3"}

# Open the output file
with open("project_structure.txt", "w", encoding="utf-8") as f:
    for root, dirs, files in os.walk(ROOT_DIR):
        # Modify dirs in-place to exclude certain directories
        dirs[:] = [d for d in dirs if d not in excluded_dirs]
        
        # Calculate the indentation level
        level = root.replace(ROOT_DIR, '').count(os.sep)
        indent = ' ' * 4 * level
        f.write(f"{indent}- {os.path.basename(root)}/\n")
        
        # Process files
        for file in files:
            if not any(file.endswith(ext) for ext in excluded_files):
                f.write(f"{indent}    - {file}\n")

print("Directory structure has been written to project_structure.txt")
