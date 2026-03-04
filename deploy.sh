#!/bin/bash

# Deploy script for Vercel auto-push

MESSAGE="${1:-Mise a jour de l'app}"

echo "🚀 Deploiement: $MESSAGE"
echo ""

# Ajouter tous les changements
echo "📝 Preparation des changements..."
git add .

# Commit
echo "💾 Commit en cours..."
git commit -m "$MESSAGE"

# Push vers GitHub (Vercel se deploie automatiquement)
echo "🌐 Envoi vers GitHub..."
git push origin master

echo ""
echo "✅ Termine! Vercel se deploie... Verifier: https://vercel.com/dashboard"
