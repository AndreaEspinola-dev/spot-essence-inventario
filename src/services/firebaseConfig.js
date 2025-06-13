// Importa solo una vez cada SDK que usas
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; 


const firebaseConfig = {
  apiKey: "AIzaSyDSLmj7o2Tw_K6pN3DlRiKgIizmnPzROMI",
  authDomain: "inventario-spot.firebaseapp.com",
  projectId: "inventario-spot",
  storageBucket: "inventario-spot.firebasestorage.app",
  messagingSenderId: "21269066294",
  appId: "1:21269066294:web:d2c6e9c1791baa9325de97"
};

// Inicializa solo una vez
const app = initializeApp(firebaseConfig);

// Exporta los servicios que usarás
export const auth = getAuth(app);
export const db = getFirestore(app); 
