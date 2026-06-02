// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCw9NYlw0XLC26Di-nFCNOuL7D6RX8k820",
  authDomain: "komisyoneri-platform-prod.firebaseapp.com",
  projectId: "komisyoneri-platform-prod",
  storageBucket: "komisyoneri-platform-prod.firebasestorage.app",
  messagingSenderId: "766901928352",
  appId: "1:766901928352:web:9df910b36a462e1fb524c5",
  measurementId: "G-ERRNCE85E2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);