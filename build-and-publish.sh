#!/bin/bash

# Run the build script
echo "Building package..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build successful. Publishing..."
    
    # Get the current version
    current_version=$(node -p "require('./package.json').version")
    
    # Publish to npm
    npm publish
    
    if [ $? -eq 0 ]; then
        echo "Successfully published version $current_version to npm"
        
        # Commit changes
        ./git-commit.sh "Build and publish version $current_version"
        
        if [ $? -eq 0 ]; then
            echo "Changes committed successfully"
        else
            echo "Failed to commit changes"
            exit 1
        fi
    else
        echo "Failed to publish to npm"
        exit 1
    fi
else
    echo "Build failed. Publish aborted."
    exit 1
fi