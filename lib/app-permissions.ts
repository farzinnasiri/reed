import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { requestAppNotificationPermissionsAsync } from '@/lib/background-alerts';

let appCapabilityPermissionRequest: Promise<void> | null = null;

export function requestAppCapabilityPermissionsAsync() {
  if (!appCapabilityPermissionRequest) {
    appCapabilityPermissionRequest = requestAppCapabilityPermissionsOnceAsync();
  }

  return appCapabilityPermissionRequest;
}

async function requestAppCapabilityPermissionsOnceAsync() {
  await requestAppNotificationPermissionsAsync();

  if (Platform.OS === 'web') {
    return;
  }

  const cameraPermission = await ImagePicker.getCameraPermissionsAsync();
  if (!cameraPermission.granted && cameraPermission.canAskAgain) {
    await ImagePicker.requestCameraPermissionsAsync();
  }

  const mediaLibraryPermission = await ImagePicker.getMediaLibraryPermissionsAsync(false);
  if (!mediaLibraryPermission.granted && mediaLibraryPermission.canAskAgain) {
    await ImagePicker.requestMediaLibraryPermissionsAsync(false);
  }
}
