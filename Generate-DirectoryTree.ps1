# Define the exclusion patterns
$excludedDirs = @("venv", "__pycache__", "node_modules")
$excludedFiles = @("*.pyc", "*.log", "*.sqlite3")

# Function to recursively list directories and files with exclusions
function Get-DirectoryTree {
    param (
        [string]$Path = ".",
        [int]$Level = 0
    )

    # Get all items in the current directory
    Get-ChildItem -Path $Path -Force | Where-Object {
        # Exclude directories
        if ($_.PSIsContainer) {
            return -not ($excludedDirs -contains $_.Name)
        } else {
            # Exclude files based on patterns
            return -not ($excludedFiles | ForEach-Object { $_ } | Where-Object { $_ -like $_.Name })
        }
    } | ForEach-Object {
        # Indentation based on level
        $indent = " " * ($Level * 4)
        if ($_.PSIsContainer) {
            Write-Output "$indent`- $_"
            # Recurse into the directory
            Get-DirectoryTree -Path $_.FullName -Level ($Level + 1)
        } else {
            Write-Output "$indent`- $_"
        }
    }
}

# Execute the function and output to a text file
Get-DirectoryTree | Out-File -FilePath "project_structure.txt" -Encoding utf8
