import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import DocumentScanner, {
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import OverlayEditor from './OverlayEditor';

export default function App() {
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Ready to scan');
  const [error, setError] = useState<string | null>(null);
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const scanDocument = async () => {
    try {
      setStatus('Opening scanner...');
      setError(null);

      const { scannedImages, status: scanStatus } =
        await DocumentScanner.scanDocument({ croppedImageQuality: 90 });

      if (scanStatus === ScanDocumentResponseStatus.Cancel) {
        setStatus('Scan cancelled');
        return;
      }

      if (scannedImages && scannedImages.length > 0) {
        const imagePath = scannedImages[0]!;
        await CameraRoll.saveAsset(imagePath, { type: 'photo', album: 'HALO Scans' });

        console.log('Document saved to camera roll');
        console.log('  Path:', imagePath);
        console.log('  Time:', new Date().toLocaleTimeString());
        console.log('  Album: HALO Scans');

        setScannedImage(imagePath);
        setStatus('Saved to camera roll!');
      }
    } catch (e: any) {
      const msg = e?.message || e?.toString() || JSON.stringify(e) || 'Unknown error';
      setError(msg);
      setStatus('Error');
      console.error('Scan error:', e);
    }
  };

  const selectPhoto = async () => {
    try {
      setStatus('Opening photo library...');
      setError(null);

      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
      });

      if (result.didCancel) {
        setStatus('Selection cancelled');
        return;
      }

      const uri = result.assets?.[0]?.uri;
      if (uri) {
        setScannedImage(uri);
        setStatus('Photo selected');
      }
    } catch (e: any) {
      const msg = e?.message || e?.toString() || JSON.stringify(e) || 'Unknown error';
      setError(msg);
      setStatus('Error');
      console.error('Photo selection error:', e);
    }
  };

  const pickOverlayImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
      });

      if (result.didCancel) {
        return;
      }

      const uri = result.assets?.[0]?.uri;
      if (uri) {
        setOverlayImage(uri);
      }
    } catch (e: any) {
      const msg = e?.message || e?.toString() || JSON.stringify(e) || 'Unknown error';
      setError(msg);
      console.error('Overlay image selection error:', e);
    }
  };

  const clearOverlayImage = () => {
    setOverlayImage(null);
  };

  const clearScan = () => {
    setScannedImage(null);
    setStatus('Ready to scan');
    setError(null);
  };

  const renderPreview = () => {
    // Show scanned image if we have one
    if (scannedImage) {
      return (
        <View style={styles.cameraPreview}>
          <Image source={{ uri: scannedImage }} style={styles.image} />
          {overlayImage && (
            <Image
              source={{ uri: overlayImage }}
              style={styles.overlayImage}
              resizeMode="contain"
            />
          )}
        </View>
      );
    }

    // No permission yet — show a prompt
    if (!hasPermission) {
      return (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Camera permission required</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // No camera device found
    if (!device) {
      return (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No camera found</Text>
        </View>
      );
    }

    // Live preview
    return (
      <View style={styles.cameraPreview}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
        />
        {overlayImage && (
          <Image
            source={{ uri: overlayImage }}
            style={styles.overlayImage}
            resizeMode="contain"
          />
        )}
      </View>
    );
  };

  if (showEditor && scannedImage && overlayImage) {
    return (
      <OverlayEditor
        baseImage={scannedImage}
        overlayImage={overlayImage}
        onDone={() => setShowEditor(false)}
        onCancel={() => setShowEditor(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>HALO Scanner</Text>
        <Text style={styles.status}>{status}</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {renderPreview()}

        <TouchableOpacity style={styles.button} onPress={scanDocument}>
          <Text style={styles.buttonText}>Scan Document</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.selectButton} onPress={pickOverlayImage}>
          <Text style={styles.selectButtonText}>
            {overlayImage ? 'Change Overlay Image' : 'Add Overlay Image'}
          </Text>
        </TouchableOpacity>

        {overlayImage && (
          <TouchableOpacity style={styles.clearButton} onPress={clearOverlayImage}>
            <Text style={styles.clearButtonText}>Remove Overlay</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.selectButton} onPress={selectPhoto}>
          <Text style={styles.selectButtonText}>Select Photo</Text>
        </TouchableOpacity>

        {scannedImage && overlayImage && (
          <TouchableOpacity style={styles.button} onPress={() => setShowEditor(true)}>
            <Text style={styles.buttonText}>Edit with Overlay</Text>
          </TouchableOpacity>
        )}

        {scannedImage && (
          <TouchableOpacity style={styles.clearButton} onPress={clearScan}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scroll: {
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111',
  },
  status: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  error: {
    fontSize: 13,
    color: '#cc0000',
    marginBottom: 12,
    textAlign: 'center',
  },
  image: {
    width: '100%',
    height: 400,
    resizeMode: 'contain',
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#e0e0e0',
  },
  placeholder: {
    width: '100%',
    height: 400,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 12,
  },
  placeholderText: {
    color: '#999',
    fontSize: 16,
  },
  permissionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#111',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  clearButtonText: {
    color: '#666',
    fontSize: 14,
  },
  cameraPreview: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  overlayImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  selectButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#111',
  },
  selectButtonText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '600',
  },
});