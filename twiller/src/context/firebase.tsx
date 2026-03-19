
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// keep your credentials 
const firebaseConfig = {
  apiKey: "AIzaSyAarL6ZeB-Y-7ZP-3rUoMuwRCCIUXjZ-Iw",
  authDomain: "twitterclone-c6ef0.firebaseapp.com",
  projectId: "twitterclone-c6ef0",
  storageBucket: "twitterclone-c6ef0.firebasestorage.app",
  messagingSenderId: "706629483988",
  appId: "1:706629483988:web:ef854fd5af771268f12a41",
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
