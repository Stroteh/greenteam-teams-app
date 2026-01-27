// firebase-config.example.js
// COPY THIS TO GITHUB SECRETS!

// This is an EXAMPLE config file. DO NOT use these values.
// Add your REAL values in GitHub Repository Secrets:
// Settings → Secrets and variables → Actions → New repository secret

window.firebaseConfig = {
  // 1. Go to Firebase Console → Project Settings → General
  // 2. Find your Web App configuration
  // 3. Copy each value to GitHub Secrets
  
  apiKey: "YOUR_API_KEY_HERE_IN_GITHUB_SECRETS",
  authDomain: "YOUR_AUTH_DOMAIN_HERE_IN_GITHUB_SECRETS",
  projectId: "YOUR_PROJECT_ID_HERE_IN_GITHUB_SECRETS",
  storageBucket: "YOUR_STORAGE_BUCKET_HERE_IN_GITHUB_SECRETS",
  messagingSenderId: "YOUR_SENDER_ID_HERE_IN_GITHUB_SECRETS",
  appId: "YOUR_APP_ID_HERE_IN_GITHUB_SECRETS"
};

// How to setup:
// 1. Create Firebase project at https://console.firebase.google.com/
// 2. Enable Firestore Database
// 3. Add Web App to get configuration
// 4. Copy values to GitHub Secrets
// 5. GitHub Actions will auto-generate firebase-config.js

console.log("⚠️ This is example config. Using localStorage fallback.");
