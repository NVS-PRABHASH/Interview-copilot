import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = 'interview-copilot-secure-key';
const STORAGE_KEY = 'interview_copilot_keys_encrypted';

export const apiKeyManager = {
  // Encrypt and store API keys
  storeKeys: (keys) => {
    try {
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify(keys), ENCRYPTION_KEY).toString();
      sessionStorage.setItem(STORAGE_KEY, encrypted);
      return true;
    } catch (error) {
      console.error('Failed to store API keys:', error);
      return false;
    }
  },

  // Decrypt and retrieve API keys
  getKeys: () => {
    try {
      const encrypted = sessionStorage.getItem(STORAGE_KEY);
      if (!encrypted) return null;
      
      const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
      const keys = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
      return keys;
    } catch (error) {
      console.error('Failed to retrieve API keys:', error);
      return null;
    }
  },

  // Clear stored keys
  clearKeys: () => {
    sessionStorage.removeItem(STORAGE_KEY);
  },

  // Check if keys exist
  hasKeys: () => {
    return !!sessionStorage.getItem(STORAGE_KEY);
  }
};