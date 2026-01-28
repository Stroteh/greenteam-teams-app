// firebase-config.js - Tako mora biti (brez export)
window.firebaseConfig = {
    apiKey: "FIREBASE_API_KEY",
    authDomain: "FIREBASE_AUTH_DOMAIN",
    projectId: "FIREBASE_PROJECT_ID",
    messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID",
    appId: "FIREBASE_APP_ID",
    storageBucket: "FIREBASE_STORAGE_BUCKET"
};


// console.log za debugging (opcijsko)
if (window.firebaseConfig) {
    console.log("✅ Firebase konfiguracija naložena");
}
