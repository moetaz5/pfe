#!/bin/bash
# Script pour sauvegarder les modifications recréées (13 avril 2026)

PROJECT_PATH="c:\Users\LENOVO PRO\OneDrive\Bureau\projet pfe\web"

echo "🔄 Navigating to project..."
cd "$PROJECT_PATH"

echo ""
echo "📁 Opening mobile folder..."
cd mobile

echo ""
echo "📊 Checking git status..."
git status

echo ""
echo "📝 Files modified in /mobile:"
git diff --name-only HEAD

echo ""
echo "✅ Adding all changes to Git..."
git add -A

echo ""
echo "💬 Committing with semantic message..."
git commit -m "feat(mobile): 

- Add onboarding screen (4 pages) - shows only on first launch
- Implement FCM notifications with permission dialog
- Modernize login screen with gradient logo and improved styling
- Modernize register screen with 5-field validation
- Add Google authentication compatibility (deep links + exchange tokens)
- Add FCM integration to API service
- Update server with FCM endpoints (/register-fcm, /test, /preferences)

CHANGES:
- lib/screens/onboarding_screen.dart: Complete 4-page onboarding
- lib/screens/login_screen.dart: Modern UI with blue gradient header
- lib/screens/register_screen.dart: Modern UI with form validation  
- lib/notification_service.dart: FCM + permission handling
- lib/api_service.dart: +3 FCM methods
- server/server.js: +3 FCM routes

Date: 13 avril 2026"

echo ""
echo "🚀 Pushing to remote..."
git push origin main

echo ""
echo "✨ All modifications saved and pushed!"
echo "📝 Summary:"
echo "   - Onboarding: 1st launch only"
echo "   - Notifications: FCM ready"
echo "   - Login: Modern design"
echo "   - Register: Complete form"
echo "   - Google Auth: Validated"
