// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAtNnbsXKFgABvP-nTvGwz6pooGnSWSshY",
  authDomain: "komisiyoneri-78e82.firebaseapp.com",
  projectId: "komisiyoneri-78e82",
  storageBucket: "komisiyoneri-78e82.firebasestorage.app",
  messagingSenderId: "580559336922",
  appId: "1:580559336922:web:e115d37c1c0149d8c0fce3",
  measurementId: "G-ZTVZQ5W9Y0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
