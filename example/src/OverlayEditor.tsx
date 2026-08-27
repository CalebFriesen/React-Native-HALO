import { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

type OverlayEditorProps = {
  baseImage: string;
  overlayImage: string;
  onDone: () => void;
  onCancel: () => void;
};

const SCALE_MIN = 0.3;
const SCALE_MAX = 2.5;
const SLIDER_TRACK_WIDTH = 240;

export default function OverlayEditor({
  baseImage,
  overlayImage,
  onDone,
  onCancel,
}: OverlayEditorProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const [scale, setScale] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Position the size-slider thumb so its initial spot matches scale = 1
  const initialThumbX =
    ((1 - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * SLIDER_TRACK_WIDTH;
  const sliderPan = useRef(new Animated.Value(initialThumbX)).current;

  // Drag-to-reposition the overlay image
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.extractOffset();
      },
    })
  ).current;

  // Hand-rolled slider for resizing the overlay (avoids needing
  // @react-native-community/slider, which had Fabric/New Architecture
  // linking issues with this project's Nitro-based native setup)
  const sliderResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const x = Math.max(
          0,
          Math.min(SLIDER_TRACK_WIDTH, gestureState.moveX - 40)
        );
        sliderPan.setValue(x);
        const newScale =
          SCALE_MIN + (x / SLIDER_TRACK_WIDTH) * (SCALE_MAX - SCALE_MIN);
        setScale(newScale);
      },
    })
  ).current;

  // Captures the ViewShot (base image + positioned overlay) as one flattened
  // image, then saves that merged result to the camera roll.
  const handleSave = async () => {
    if (!viewShotRef.current?.capture) return;

    try {
      setIsSaving(true);
      const uri = await viewShotRef.current.capture();
      await CameraRoll.saveAsset(uri, { type: 'photo', album: 'HALO Scans' });
      onDone();
    } catch (e) {
      console.error('Overlay composite save error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.topBarButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Position Overlay</Text>
        <View style={{ width: 50 }} />
      </View>

      <ViewShot
        ref={viewShotRef}
        style={styles.canvas}
        options={{ format: 'jpg', quality: 0.9 }}
      >
        <Image source={{ uri: baseImage }} style={styles.baseImage} />
        <Animated.Image
          source={{ uri: overlayImage }}
          resizeMode="contain"
          {...panResponder.panHandlers}
          style={[
            styles.overlayImage,
            {
              opacity: 0.6,
              transform: [
                ...pan.getTranslateTransform(),
                { scale },
              ],
            },
          ]}
        />
      </ViewShot>

      <View style={styles.controls}>
        <Text style={styles.sliderLabel}>Size</Text>
        <View style={styles.sliderTrack} {...sliderResponder.panHandlers}>
          <Animated.View
            style={[
              styles.sliderThumb,
              { transform: [{ translateX: sliderPan }] },
            ]}
          />
        </View>
      </View>

      <View style={styles.saveBar}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Combined Photo'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topBarButton: { color: '#fff', fontSize: 15 },
  topBarTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  canvas: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  baseImage: { ...StyleSheet.absoluteFillObject, resizeMode: 'contain' },
  overlayImage: { ...StyleSheet.absoluteFillObject },
  controls: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  sliderLabel: { color: '#fff', fontSize: 13, marginBottom: 8 },
  sliderTrack: {
    width: SLIDER_TRACK_WIDTH,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    justifyContent: 'center',
  },
  sliderThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    position: 'absolute',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  saveBar: {
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
    marginTop: 12,
  },
});