import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeColors } from '../types';
import { db } from '../firebase';
import { doc as firestoreDoc, getDoc as firestoreGetDoc, onSnapshot as firestoreOnSnapshot } from 'firebase/firestore';

// Default KetoCost Theme
export const defaultTheme: ThemeColors = {
  primary: '#5D3A29', // brand-brown
  secondary: '#F5F0EB', // brand-beige
  accent: '#D4A373', // brand-accent
  background1: '#FDFBF7', // brand-cream
  background2: '#ffffff', // white
  textMain: '#5D3A29', // brand-brown
  textMuted: '#78716c', // stone-500
};

interface ThemeContextType {
  theme: ThemeColors;
  setThemeLocal: (theme: ThemeColors) => void;
  profileName: string;
  logoUrl: string | null;
  companyAddress: string;
  companyLat?: number;
  companyLng?: number;
}

const ThemeContext = createContext<ThemeContextType>({ theme: defaultTheme, setThemeLocal: () => {}, profileName: '', logoUrl: null, companyAddress: '' });

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ userId?: string, children: React.ReactNode }> = ({ userId, children }) => {
  const [theme, setTheme] = useState<ThemeColors>(defaultTheme);
  const [profileName, setProfileName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyLat, setCompanyLat] = useState<number | undefined>(undefined);
  const [companyLng, setCompanyLng] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!userId) {
      setTheme(defaultTheme);
      setProfileName('');
      setLogoUrl(null);
      setCompanyAddress('');
      return;
    }

    const docRef = firestoreDoc(db, 'userProfiles', userId);
    
    const unsubscribe = firestoreOnSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCompanyLat(data.companyLat);
        setCompanyLng(data.companyLng);
        if (data.themeColors) {
          setTheme({ ...defaultTheme, ...data.themeColors });
        } else {
          setTheme(defaultTheme);
        }
        if (data.displayName) {
          setProfileName(data.displayName);
        } else {
          setProfileName('');
        }
        if (data.companyName) {
          localStorage.setItem('savedCompanyName', data.companyName);
        }
        if (data.logoUrl) {
          setLogoUrl(data.logoUrl);
          updateFavicon(data.logoUrl);
        } else {
          setLogoUrl(null);
          updateFavicon(null); // Or default reset if you prefer
        }
        if (data.companyAddress) {
          setCompanyAddress(data.companyAddress);
        } else {
          setCompanyAddress('');
        }
      } else {
        setTheme(defaultTheme);
        setProfileName('');
        setLogoUrl(null);
        setCompanyAddress('');
        updateFavicon(null);
      }
    }, (error) => {
      console.error("Error fetching theme/profile:", error);
    });

    return () => unsubscribe();
  }, [userId]);

  // Apply theme to CSS variables on the root element
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-brand-brown', theme.primary);
    root.style.setProperty('--color-brand-beige', theme.secondary);
    root.style.setProperty('--color-brand-accent', theme.accent);
    root.style.setProperty('--color-brand-cream', theme.background1);
    root.style.setProperty('--color-white-custom', theme.background2);
    root.style.setProperty('--color-text-main', theme.textMain);
    root.style.setProperty('--color-text-muted', theme.textMuted);
  }, [theme]);

  // Method to temporarily update theme locally before saving to DB
  const setThemeLocal = (newTheme: ThemeColors) => {
      setTheme(newTheme);
  };

  const updateFavicon = (url: string | null) => {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = url || '/vite.svg'; // Or path to default keto cost logo
  };

  // On mount, we can clean up but for now leaving as is
  useEffect(() => {
    // optional initial setup
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setThemeLocal, profileName, logoUrl, companyAddress, companyLat, companyLng }}>
      {children}
    </ThemeContext.Provider>
  );
};
