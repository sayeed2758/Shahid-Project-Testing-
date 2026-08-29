import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

/**
 * EZEE VISION CHAMPUA
 * Firebase configuration
 *
 * This is client-side Firebase Web configuration.
 * Do NOT place service-account/private keys here.
 */
const firebaseConfig = {
  apiKey: "AIzaSyAAXE62v0nC_T0QqbUh5hJ9gDHoahMFOdc",
  authDomain: "ezee-vision-champua.firebaseapp.com",
  databaseURL: "https://ezee-vision-champua-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ezee-vision-champua",
  storageBucket: "ezee-vision-champua.firebasestorage.app",
  messagingSenderId: "157634563496",
  appId: "1:157634563496:web:d07e76481898d7153ae19d"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

export { firebaseApp, auth };
