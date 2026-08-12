import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDCKqXDrY5-JInXpbS0XswY2HLBWv6oAGs",
  authDomain: "travelshare-b6659.firebaseapp.com",
  projectId: "travelshare-b6659",
  storageBucket: "travelshare-b6659.appspot.com",
  messagingSenderId: "239779044272",
  appId: "1:239779044272:web:ce14af3d8e47c3b0d9f1a4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const docRef = doc(db, 'posts', '3WmDRotX3QSC6wh4SZAv');
const snap = await getDoc(docRef);
if (snap.exists()) {
  console.log(JSON.stringify(snap.data(), null, 2));
} else {
  console.log('NOT FOUND');
}
process.exit(0);
