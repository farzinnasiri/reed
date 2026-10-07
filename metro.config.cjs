const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Node 25 can expose an unusable localStorage object without a storage file.
// Expo's notification SSR code tests existence before calling getItem.
if (typeof globalThis.localStorage !== 'undefined' && typeof globalThis.localStorage.getItem !== 'function') {
  Reflect.deleteProperty(globalThis, 'localStorage');
}

config.resolver.assetExts.push('gz');
module.exports = config;
