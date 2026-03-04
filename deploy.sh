#!/bin/bash

# Deploy script for Vercel auto-push

MESSAGE="${1:-Update todo app}"

echo "🚀 Deploying: $MESSAGE"
echo ""

# Add all changes
echo "📝 Staging changes..."
git add .

# Commit
echo "💾 Committing..."
git commit -m "$MESSAGE"

# Push to GitHub (Vercel auto-deploys)
echo "🌐 Pushing to GitHub..."
git push origin master

echo ""
echo "✅ Done! Vercel is deploying... Check: https://vercel.com/dashboard"
