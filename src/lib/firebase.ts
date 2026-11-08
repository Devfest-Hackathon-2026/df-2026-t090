import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAYRs85E6ordzPZpIv_tmcSJ2zROc2DIf0",
  authDomain: "project-7f11774d-0f3a-4228-93f.firebaseapp.com",
  projectId: "project-7f11774d-0f3a-4228-93f",
  storageBucket: "project-7f11774d-0f3a-4228-93f.firebasestorage.app",
  messagingSenderId: "1045771000909",
  appId: "1:1045771000909:web:0ab9095978c1146b1d9004",
};

// 二重初期化を防止
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider };
