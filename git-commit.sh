#!/bin/bash

# Check if a commit message is provided
if [ $# -eq 0 ]; then
    echo "Error: Please provide a commit message."
    echo "Usage: $0 <commit message>"
    exit 1
fi

# Combine all arguments into a single commit message
commit_message="$*"

# Run git add .
git add .

# Run git commit with the provided message
git commit -m "$commit_message"

echo "Changes committed with message: $commit_message"