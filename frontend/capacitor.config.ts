import type { CapacitorConfig } from '@capacitor/cli';

/** Android incorpora el bundle Angular; no depende de una web remota para mostrar la interfaz. */
const config: CapacitorConfig = {
  appId: 'com.smartgymbro.app',
  appName: 'Gymbro AI',
  webDir: 'dist/smartgymbro/browser',
  server: { androidScheme: 'https' },
  android: { backgroundColor: '#090d18' },
  plugins: { LocalNotifications: { smallIcon:'gymbro_notification', iconColor:'#a3e635' } },
};
export default config;
