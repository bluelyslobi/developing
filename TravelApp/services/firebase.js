import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyD3oNQeQVZ93h-7cFs4HJL5RTHT76_rCZg',
  authDomain: 'travelshare-b6659.firebaseapp.com',
  projectId: 'travelshare-b6659',
  storageBucket: 'travelshare-b6659.firebasestorage.app',
  messagingSenderId: '895580577719',
  appId: '1:895580577719:web:2ea7e322789cfb6a2c1232',
};

const app = initializeApp(firebaseConfig);

// getReactNativePersistence is undefined in the web build of firebase/auth —
// calling it unconditionally crashes the app on web (npx expo start --web).
export const auth = Platform.OS === 'web'
  ? getAuth(app)
  : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

export const db = getFirestore(app);
export const storage = getStorage(app);
