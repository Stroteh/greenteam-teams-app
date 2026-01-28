
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "placeholder-key",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "placeholder.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "placeholder-project",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "placeholder.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "placeholder",
  appId: process.env.FIREBASE_APP_ID || "placeholder",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "placeholder"
};

export default firebaseConfig;
