#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Function to display usage
usage() {
  echo "Usage: $0 [patch|minor|major]"
  echo "Default is patch"
  exit 1
}

# Determine bump type (default to patch)
BUMP_TYPE=${1:-patch}

if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "Error: Invalid bump type '$BUMP_TYPE'."
  usage
fi

# Ensure working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Your working directory is not clean. Please commit or stash your changes first."
  exit 1
fi

# Get current branch name
CURRENT_BRANCH=$(git symbolic-ref --short HEAD)

if [[ "$CURRENT_BRANCH" != "develop" && "$CURRENT_BRANCH" != "main" ]]; then
  echo "Error: You must be on 'develop' or 'main' branch to release. Current branch is '$CURRENT_BRANCH'."
  exit 1
fi

echo "Current branch is: $CURRENT_BRANCH"
echo "Bumping version ($BUMP_TYPE) and releasing..."

# 1. Bump version and create git commit + tag
# This will bump version in package.json/package-lock.json and commit/tag them.
npm version "$BUMP_TYPE"

# Get the new version tag
NEW_VERSION=$(node -p "require('./package.json').version")
echo "Successfully bumped version to v$NEW_VERSION"

# 2. Push current branch and its tags
echo "Pushing $CURRENT_BRANCH and tags to origin..."
git push origin "$CURRENT_BRANCH"
git push origin "v$NEW_VERSION"

# 3. Merge to the other branch and push it
if [ "$CURRENT_BRANCH" = "develop" ]; then
  OTHER_BRANCH="main"
else
  OTHER_BRANCH="develop"
fi

echo "Switching to $OTHER_BRANCH branch to merge changes..."
git checkout "$OTHER_BRANCH"

# Pull latest to avoid conflicts
git pull origin "$OTHER_BRANCH"

# Merge CURRENT_BRANCH into OTHER_BRANCH
echo "Merging $CURRENT_BRANCH into $OTHER_BRANCH..."
git merge "$CURRENT_BRANCH" --no-edit

# Push OTHER_BRANCH
echo "Pushing $OTHER_BRANCH to origin..."
git push origin "$OTHER_BRANCH"

# Checkout back to original branch
echo "Switching back to $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH"

echo "Release v$NEW_VERSION completed and pushed successfully to both develop and main!"
