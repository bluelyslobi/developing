import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export async function pickAndUploadImage(storagePath) {
  const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
  });
  if (result.canceled) return null;

  const uri = result.assets[0].uri;
  const resp = await fetch(uri);
  const blob = await resp.blob();
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob);
  return await getDownloadURL(storageRef);
}
