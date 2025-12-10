import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyD8bIUJRuVCE10Uvap1z_aCVpc1mstcMoc",
  authDomain: "calculadora-keto-1eb5e.firebaseapp.com",
  projectId: "calculadora-keto-1eb5e",
  storageBucket: "calculadora-keto-1eb5e.firebasestorage.app",
  messagingSenderId: "503210674682",
  appId: "1:503210674682:web:fa80952a2590c683b6fc43",
  measurementId: "G-71LLSKPZSX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);