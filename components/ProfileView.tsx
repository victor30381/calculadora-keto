import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useTheme, defaultTheme } from './ThemeContext';
import { ThemeColors, UserProfile } from '../types';

const MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

const loadGoogleMaps = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if ((window as any).google?.maps) { resolve(); return; }
        if (!MAPS_API_KEY || MAPS_API_KEY === 'TU_API_KEY_AQUI') { reject(new Error('API_KEY_MISSING')); return; }
        const existingScript = document.getElementById('google-maps-script');
        if (existingScript) { existingScript.addEventListener('load', () => resolve()); return; }
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places,geometry`;
        script.async = true; script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('MAPS_LOAD_FAILED'));
        document.head.appendChild(script);
    });
};


interface ProfileViewProps {
  user: User | null;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user }) => {
  const { theme, setThemeLocal } = useTheme();
  
  const [profileData, setProfileData] = useState<UserProfile>({
    userId: user?.uid || '',
    displayName: user?.displayName || '',
    companyName: '',
    instagram: '',
    facebook: '',
    website: '',
    whatsappPhone: '',
    companyAddress: '',
    themeColors: defaultTheme,
  });

  const [localTheme, setLocalTheme] = useState<ThemeColors>(theme);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });
  const [loadingInitial, setLoadingInitial] = useState(true);
  
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    loadGoogleMaps().then(() => setMapsLoaded(true)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!mapsLoaded || loadingInitial || !mapRef.current) return;
    if (mapInstanceRef.current) return; // Already initialized

    const initialPos = profileData.companyLat && profileData.companyLng 
      ? { lat: profileData.companyLat, lng: profileData.companyLng } 
      : { lat: -34.6037, lng: -58.3816 };

    const map = new google.maps.Map(mapRef.current, {
        center: initialPos,
        zoom: (profileData.companyLat && profileData.companyLng) ? 15 : 10,
        disableDefaultUI: false,
    });
    mapInstanceRef.current = map;

    const marker = new google.maps.Marker({
        position: initialPos,
        map: map,
        draggable: true,
        title: "Ubicación de la Empresa",
        icon: {
            url: '/logo.png',
            scaledSize: new google.maps.Size(46, 46),
            origin: new google.maps.Point(0,0),
            anchor: new google.maps.Point(23,23),
        },
        zIndex: 999
    });
    markerRef.current = marker;

    marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        if (pos) {
            setProfileData(prev => ({
                ...prev,
                companyLat: pos.lat(),
                companyLng: pos.lng()
            }));
        }
    });
    
    map.addListener('click', (e: any) => {
        const pos = e.latLng;
        marker.setPosition(pos);
        setProfileData(prev => ({
             ...prev,
             companyLat: pos.lat(),
             companyLng: pos.lng()
        }));
    });
  }, [mapsLoaded, loadingInitial, profileData.companyLat, profileData.companyLng]);

  const handleLocateAddress = () => {
      if (!mapsLoaded || !mapInstanceRef.current || !profileData.companyAddress) return;
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: profileData.companyAddress, componentRestrictions: { country: 'AR' } }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
              const location = results[0].geometry.location;
              mapInstanceRef.current!.setCenter(location);
              mapInstanceRef.current!.setZoom(16);
              markerRef.current?.setPosition(location);
              setProfileData(prev => ({
                  ...prev,
                  companyLat: location.lat(),
                  companyLng: location.lng()
              }));
          } else {
              alert('No se pudo ubicar la dirección. Por favor, intentá arrastrando el marcador manualmente en el mapa.');
          }
      });
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, 'userProfiles', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          setProfileData({
            ...data,
            userId: user.uid, // Ensure ID matches
          });
          if (data.themeColors) {
             setLocalTheme(data.themeColors);
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newTheme = { ...localTheme, [name]: value };
    setLocalTheme(newTheme);
    // Preview changes instantly locally
    setThemeLocal(newTheme);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    const file = e.target.files[0];
    setIsUploadingLogo(true);
    setSaveMessage({ type: '', text: '' });
    
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `logos/${user.uid}_${Date.now()}.${fileExt}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      setProfileData(prev => ({ ...prev, logoUrl: downloadURL }));
      
      // Auto-save the logo to Firestore so it reflects globally instantly
      await setDoc(doc(db, 'userProfiles', user.uid), { logoUrl: downloadURL }, { merge: true });
      
      setSaveMessage({ type: 'success', text: 'Logo subido y actualizado correctamente.' });
    } catch (error: any) {
      console.error(error);
      setSaveMessage({ type: 'error', text: 'Error al subir el logo. Verifica las reglas de Firebase Storage.' });
    } finally {
      setIsUploadingLogo(false);
      e.target.value = ''; // clear input
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);
    setSaveMessage({ type: '', text: '' });
    
    try {
      const docRef = doc(db, 'userProfiles', user.uid);
      const dataToSave: UserProfile = {
        ...profileData,
        userId: user.uid,
        themeColors: localTheme
      };
      
      await setDoc(docRef, dataToSave, { merge: true });
      setSaveMessage({ type: 'success', text: 'Perfil y colores guardados correctamente.' });
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage({ type: '', text: '' }), 3000);
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error.message || 'Error al guardar el perfil.' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaultTheme = () => {
    setLocalTheme(defaultTheme);
    setThemeLocal(defaultTheme);
  };

  if (loadingInitial) {
    return <div className="animate-pulse bg-white p-6 rounded-2xl shadow-sm h-64 border border-[#E5DCD3]"></div>;
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0 animate-fade-in">
      <div className="glass-card-strong rounded-3xl p-6 md:p-8">
        <h2 className="text-2xl font-serif font-bold text-brand-brown mb-6 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Mi Perfil y Personalización
        </h2>

         <div className="bg-brand-brown/5 rounded-2xl p-5 border border-brand-brown/10 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in-up">
            <div>
            <h3 className="font-bold text-brand-brown text-lg flex items-center gap-2">
                <span>🛍️</span> Enlace a tu Catálogo Público
            </h3>
            <p className="text-sm text-brand-brown/60">Comparte este enlace con tus clientes para que puedan ver tus productos y hacer pedidos.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <input 
                type="text" 
                readOnly 
                value="https://www.alternativaketo.com"
                className="flex-1 md:w-72 p-3 rounded-xl border border-brand-brown/20 bg-white text-brand-brown text-sm font-medium outline-none text-center sm:text-left"
                onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button 
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText("https://www.alternativaketo.com");
                    alert('¡Enlace copiado al portapapeles!');
                }}
                className="px-6 py-3 bg-brand-brown text-white font-bold rounded-xl hover:bg-[#5D4229] transition-colors whitespace-nowrap shadow-md"
            >
                Copiar
            </button>
            </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          
          {/* Logo Upload Section */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 bg-brand-cream/50 p-6 rounded-2xl border border-stone-200">
            <div className="relative group shrink-0">
              {profileData.logoUrl ? (
                <img src={profileData.logoUrl} alt="Logo" className="w-24 h-24 rounded-full object-cover shadow-sm bg-white" />
              ) : (
                <div className="w-24 h-24 rounded-full warm-gradient-brown flex items-center justify-center text-white text-3xl font-bold shadow-sm">
                  {(profileData.companyName || profileData.displayName || 'K').charAt(0).toUpperCase()}
                </div>
              )}
              {profileData.logoUrl && (
                <button
                  type="button"
                  onClick={async () => {
                    setProfileData(prev => ({ ...prev, logoUrl: '' }));
                    if (user) {
                      await setDoc(doc(db, 'userProfiles', user.uid), { logoUrl: '' }, { merge: true });
                    }
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm shadow-md hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Eliminar logo"
                >
                  ×
                </button>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
               <h3 className="font-bold text-brand-brown mb-1.5">Logo de la Empresa</h3>
               <p className="text-sm text-brand-brown/60 mb-4 max-w-md">Sube el logotipo de tu marca. Aparecerá en el encabezado de tu catálogo público y en tus comprobantes.</p>
               <label className={`px-4 py-2 border border-brand-brown text-brand-brown font-bold text-sm rounded-xl cursor-pointer hover:bg-brand-brown hover:text-white transition-colors inline-block ${isUploadingLogo ? 'opacity-50 cursor-not-allowed' : ''}`}>
                 {isUploadingLogo ? 'Subiendo...' : 'Subir Nuevo Logo'}
                 <input type="file" className="hidden" accept="image/*" disabled={isUploadingLogo} onChange={handleLogoUpload} />
               </label>
            </div>
          </div>
          
          {/* Personal & Company Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
               <div>
                <label className="block text-sm font-bold text-brand-brown mb-1.5">Nombre de Usuario</label>
                <input
                  type="text"
                  name="displayName"
                  value={profileData.displayName}
                  onChange={handleInputChange}
                  className="w-full p-4 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-brand-cream placeholder-stone-400 transition-all font-medium"
                   placeholder="Tu nombre completo"
                />
              </div>

               <div>
                <label className="block text-sm font-bold text-brand-brown mb-1.5">Email (No editable)</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full p-4 rounded-xl border border-stone-100 text-stone-500 bg-stone-50 cursor-not-allowed font-medium"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-brand-brown mb-1.5">Nombre de la Empresa</label>
                <input
                  type="text"
                  name="companyName"
                  value={profileData.companyName}
                  onChange={handleInputChange}
                  className="w-full p-4 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-brand-cream placeholder-stone-400 transition-all font-medium"
                  placeholder="Ej: AlternativaKeto"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                 <div>
                  <label className="block text-sm font-bold text-brand-brown mb-1.5">Instagram @</label>
                  <input
                    type="text"
                    name="instagram"
                    value={profileData.instagram}
                    onChange={handleInputChange}
                    className="w-full p-4 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-brand-cream placeholder-stone-400 transition-all"
                    placeholder="usuario_ig"
                  />
                </div>
                 <div>
                  <label className="block text-sm font-bold text-brand-brown mb-1.5">Facebook</label>
                  <input
                    type="text"
                    name="facebook"
                    value={profileData.facebook}
                    onChange={handleInputChange}
                    className="w-full p-4 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-brand-cream placeholder-stone-400 transition-all"
                    placeholder="Enlace o nombre"
                  />
                </div>
                 <div>
                  <label className="block text-sm font-bold text-brand-brown mb-1.5">WhatsApp (Solo N°)</label>
                  <input
                    type="text"
                    name="whatsappPhone"
                    value={profileData.whatsappPhone || ''}
                    onChange={handleInputChange}
                    className="w-full p-4 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-brand-cream placeholder-stone-400 transition-all"
                    placeholder="Ej: 5491132427375"
                    title="Ingresá el número con código de país y área sin el signo + ni espacios"
                  />
                </div>
              </div>
              <div className="pt-2">
                <label className="block text-sm font-bold text-brand-brown mb-1.5">Página Web</label>
                <div className="relative">
                  <span className="absolute left-4 top-4 text-brand-brown/40 font-bold">🌐</span>
                  <input
                    type="url"
                    name="website"
                    value={profileData.website || ''}
                    onChange={handleInputChange}
                    className="w-full p-4 pl-12 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-brand-cream placeholder-stone-400 transition-all font-medium"
                    placeholder="https://www.tuweb.com"
                  />
                </div>
              </div>
              <div className="pt-2">
                <label className="block text-sm font-bold text-brand-brown mb-1.5">Domicilio de la Empresa</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-4 text-brand-brown/40 font-bold">📍</span>
                    <input
                      type="text"
                      name="companyAddress"
                      value={profileData.companyAddress || ''}
                      onChange={handleInputChange}
                      className="w-full p-4 pl-12 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-brand-cream placeholder-stone-400 transition-all font-medium"
                      placeholder="Ej: Av. Corrientes 1234, CABA"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={handleLocateAddress}
                    className="px-4 py-4 bg-brand-brown text-white font-bold rounded-xl shadow-md hover:bg-[#5D4229] transition-colors whitespace-nowrap"
                  >
                    Buscar en Mapa
                  </button>
                </div>
                
                {/* Map container */}
                <div className="mt-4 rounded-xl overflow-hidden shadow-sm border border-stone-200 relative h-64 w-full">
                  {!mapsLoaded && (
                     <div className="absolute inset-0 flex items-center justify-center bg-stone-50">
                        <span className="text-sm font-medium text-stone-500">Cargando mapa...</span>
                     </div>
                  )}
                  <div ref={mapRef} className="w-full h-full" />
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  Podes arrastrar el marcador con tu logo directamente al punto exacto para guardar tu ubicación precisa.
                </p>
              </div>
            </div>
          </div>

          <div className="decorative-line w-full my-2"></div>

          {/* Theme Colors Editor */}
          <div>
            <div className="flex justify-between items-end mb-4">
                <div>
                   <h3 className="text-xl font-serif font-bold text-brand-brown">Paleta de Colores</h3>
                   <p className="text-sm text-stone-500">Personaliza los colores de tu aplicación en tiempo real.</p>
                </div>
                <button 
                  type="button" 
                  onClick={resetToDefaultTheme}
                  className="text-sm text-brand-accent hover:text-brand-brown font-bold flex items-center gap-1 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  Restablecer
                </button>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 glass-card rounded-2xl">
                
                <div className="flex flex-col gap-2">
                   <label className="text-xs font-bold text-brand-brown uppercase">Color Primario (Botones)</label>
                   <div className="flex items-center gap-3">
                     <input type="color" name="primary" value={localTheme.primary} onChange={handleColorChange} className="h-10 w-10 md:h-12 md:w-12 rounded-lg cursor-pointer border-0 p-0 bg-transparent flex-shrink-0" />
                     <input type="text" name="primary" value={localTheme.primary} onChange={handleColorChange} className="w-full text-sm p-2 rounded border border-stone-200 uppercase font-mono bg-white" />
                   </div>
                </div>

                <div className="flex flex-col gap-2">
                   <label className="text-xs font-bold text-brand-brown uppercase">Color Secundario (Fondo App)</label>
                   <div className="flex items-center gap-3">
                     <input type="color" name="secondary" value={localTheme.secondary} onChange={handleColorChange} className="h-10 w-10 md:h-12 md:w-12 rounded-lg cursor-pointer border-0 p-0 bg-transparent flex-shrink-0" />
                     <input type="text" name="secondary" value={localTheme.secondary} onChange={handleColorChange} className="w-full text-sm p-2 rounded border border-stone-200 uppercase font-mono bg-white" />
                   </div>
                </div>

                <div className="flex flex-col gap-2">
                   <label className="text-xs font-bold text-brand-brown uppercase">Detalles / Detalles</label>
                   <div className="flex items-center gap-3">
                     <input type="color" name="accent" value={localTheme.accent} onChange={handleColorChange} className="h-10 w-10 md:h-12 md:w-12 rounded-lg cursor-pointer border-0 p-0 bg-transparent flex-shrink-0" />
                     <input type="text" name="accent" value={localTheme.accent} onChange={handleColorChange} className="w-full text-sm p-2 rounded border border-stone-200 uppercase font-mono bg-white" />
                   </div>
                </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-xs font-bold text-brand-brown uppercase">Color Cajas Blancas</label>
                   <div className="flex items-center gap-3">
                     <input type="color" name="background1" value={localTheme.background1} onChange={handleColorChange} className="h-10 w-10 md:h-12 md:w-12 rounded-lg cursor-pointer border-0 p-0 bg-transparent flex-shrink-0" />
                     <input type="text" name="background1" value={localTheme.background1} onChange={handleColorChange} className="w-full text-sm p-2 rounded border border-stone-200 uppercase font-mono bg-white" />
                   </div>
                </div>

                {/* Additional text colors to match */}
                 <div className="flex flex-col gap-2">
                   <label className="text-xs font-bold text-brand-brown uppercase">Color Texto Principal</label>
                   <div className="flex items-center gap-3">
                     <input type="color" name="textMain" value={localTheme.textMain} onChange={handleColorChange} className="h-10 w-10 md:h-12 md:w-12 rounded-lg cursor-pointer border-0 p-0 bg-transparent flex-shrink-0" />
                     <input type="text" name="textMain" value={localTheme.textMain} onChange={handleColorChange} className="w-full text-sm p-2 rounded border border-stone-200 uppercase font-mono bg-white" />
                   </div>
                </div>
                
                 <div className="flex flex-col gap-2">
                   <label className="text-xs font-bold text-brand-brown uppercase">Color Texto Secundario</label>
                   <div className="flex items-center gap-3">
                     <input type="color" name="textMuted" value={localTheme.textMuted} onChange={handleColorChange} className="h-10 w-10 md:h-12 md:w-12 rounded-lg cursor-pointer border-0 p-0 bg-transparent flex-shrink-0" />
                     <input type="text" name="textMuted" value={localTheme.textMuted} onChange={handleColorChange} className="w-full text-sm p-2 rounded border border-stone-200 uppercase font-mono bg-white" />
                   </div>
                </div>

            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-[#E5DCD3]">
            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-4 warm-gradient-brown text-white rounded-xl font-bold font-serif shadow-lg btn-glow transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            {saveMessage.text && (
              <span className={`text-sm font-semibold p-2 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {saveMessage.text}
              </span>
            )}
          </div>

        </form>
      </div>
    </div>
  );
};

export default ProfileView;
