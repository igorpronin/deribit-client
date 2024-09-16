#!/bin/bash

# Function to display usage information
usage() {
    echo "Usage: $0 <major|minor|patch> <commit message>"
    exit 1
}

# Check if both arguments are provided
if [ $# -lt 2 ]; then
    usage
fi

# Extract version type and commit message
version_type=$1
shift
commit_message="$*"

# Run update-version.sh
./update-version.sh "$version_type"

# Check if update-version.sh was successful
if [ $? -eq 0 ]; then
    # If successful, run git-commit.sh
    ./git-commit.sh "$commit_message"
else
    echo "Version update failed. Commit aborted."
    exit 1
fi