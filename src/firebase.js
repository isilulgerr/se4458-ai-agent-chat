// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDILiO_1SVYEVPeUssiSE5EInODWGXeGOI",
  authDomain: "reactchatapp-9e997.firebaseapp.com",
  projectId: "reactchatapp-9e997",
  storageBucket: "reactchatapp-9e997.firebasestorage.app",
  messagingSenderId: "247799254135",
  appId: "1:247799254135:web:e0e23a84f436f0eb2bca72"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
