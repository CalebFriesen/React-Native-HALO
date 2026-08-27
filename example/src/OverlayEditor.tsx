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
const CROP_HANDLE_SIZE = 28;
const CROP_MIN_SIZE = 60;

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

  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 20, y: 20, width: 200, height: 200 });

  // While true, the ViewShot content is temporarily clipped/shifted to just
  // the crop rectangle so capture() only grabs that region. Toggled on right
  // before capture and off right after.
  const [isCaptureClipped, setIsCaptureClipped] = useState(false);

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

  // Drag the crop rectangle's body to move it around the canvas.
  // Uses a "start position + total delta" pattern (via a ref captured on
  // grant) rather than "prev + delta", since gestureState.dx/dy are already
  // cumulative from the start of the gesture — adding them onto the
  // continuously-updating prev state would double-count movement every
  // frame and cause the rectangle to snap to its boundary almost instantly.
  const cropStartRef = useRef({ x: 0, y: 0 });

  const cropBodyPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        cropStartRef.current = { x: cropRect.x, y: cropRect.y };
      },
      onPanResponderMove: (_, gestureState) => {
        setCropRect((prev) => {
          const nextX = Math.max(
            0,
            Math.min(
              canvasSizeRef.current.width - prev.width,
              cropStartRef.current.x + gestureState.dx
            )
          );
          const nextY = Math.max(
            0,
            Math.min(
              canvasSizeRef.current.height - prev.height,
              cropStartRef.current.y + gestureState.dy
            )
          );
          return { ...prev, x: nextX, y: nextY };
        });
      },
    })
  ).current;

  // Drag the bottom-right handle to resize the crop rectangle.
  // Same start-position-ref pattern as above, applied to width/height.
  const cropSizeStartRef = useRef({ width: 0, height: 0 });

  const cropCornerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        cropSizeStartRef.current = {
          width: cropRect.width,
          height: cropRect.height,
        };
      },
      onPanResponderMove: (_, gestureState) => {
        setCropRect((prev) => {
          const nextWidth = Math.max(
            CROP_MIN_SIZE,
            Math.min(
              canvasSizeRef.current.width - prev.x,
              cropSizeStartRef.current.width + gestureState.dx
            )
          );
          const nextHeight = Math.max(
            CROP_MIN_SIZE,
            Math.min(
              canvasSizeRef.current.height - prev.y,
              cropSizeStartRef.current.height + gestureState.dy
            )
          );
          return { ...prev, width: nextWidth, height: nextHeight };
        });
      },
    })
  ).current;

  const handleCanvasLayout = (e: any) => {
    const { width, height } = e.nativeEvent.layout;
    canvasSizeRef.current = { width, height };
    setCropRect((prev) => ({
      x: Math.min(prev.x, Math.max(0, width - prev.width)),
      y: Math.min(prev.y, Math.max(0, height - prev.height)),
      width: Math.min(prev.width, width),
      height: Math.min(prev.height, height),
    }));
  };

  // Captures the base image + positioned overlay as one flattened image,
  // then saves that result to the camera roll. If cropping is active, the
  // capture is clipped/shifted to just the crop rectangle first; otherwise
  // the full canvas is captured as-is.
  const handleSave = async () => {
    if (!viewShotRef.current?.capture) return;

    try {
      setIsSaving(true);

      // Only clip to the crop rectangle if the user left cropping active.
      // Otherwise, capture the full canvas as-is.
      if (isCropping) {
        setIsCaptureClipped(true);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const uri = await viewShotRef.current.capture();
      await CameraRoll.saveAsset(uri, { type: 'photo', album: 'HALO Scans' });

      setIsCaptureClipped(false);
      setIsCropping(false);
      onDone();
    } catch (e) {
      console.error('Overlay composite save error:', e);
      setIsCaptureClipped(false);
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
        <TouchableOpacity onPress={() => setIsCropping((v) => !v)}>
          <Text style={styles.topBarButton}>
            {isCropping ? 'Done Crop' : 'Crop'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.canvasWrapper} onLayout={handleCanvasLayout}>
        <ViewShot
          ref={viewShotRef}
          style={[
            styles.canvas,
            isCaptureClipped
              ? {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: cropRect.width,
                  height: cropRect.height,
                  overflow: 'hidden',
                }
              : { width: '100%', height: '100%' },
          ]}
          options={{ format: 'jpg', quality: 0.9 }}
        >
          <View
            style={[
              styles.canvasContent,
              isCaptureClipped
                ? {
                    width: canvasSizeRef.current.width,
                    height: canvasSizeRef.current.height,
                    transform: [
                      { translateX: -cropRect.x },
                      { translateY: -cropRect.y },
                    ],
                  }
                : { width: '100%', height: '100%' },
            ]}
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
          </View>
        </ViewShot>

        {isCropping && !isCaptureClipped && (
          <>
            {/* Dimmed areas outside the crop rectangle */}
            <View pointerEvents="none" style={styles.dimOverlay} />

            <View
              style={[
                styles.cropRect,
                {
                  top: cropRect.y,
                  left: cropRect.x,
                  width: cropRect.width,
                  height: cropRect.height,
                },
              ]}
              {...cropBodyPanResponder.panHandlers}
            >
              <View
                style={styles.cropCornerHandle}
                {...cropCornerPanResponder.panHandlers}
              />
            </View>
          </>
        )}
      </View>

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
            {isSaving
              ? 'Saving...'
              : isCropping
              ? 'Crop & Save Combined Photo'
              : 'Save Combined Photo'}
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
  canvasWrapper: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
    position: 'relative',
  },
  canvas: {
    backgroundColor: '#111',
  },
  canvasContent: {
    position: 'relative',
  },
  baseImage: { ...StyleSheet.absoluteFillObject, resizeMode: 'contain' },
  overlayImage: { ...StyleSheet.absoluteFillObject },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cropRect: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#22c55e',
    backgroundColor: 'transparent',
  },
  cropCornerHandle: {
    position: 'absolute',
    bottom: -CROP_HANDLE_SIZE / 2,
    right: -CROP_HANDLE_SIZE / 2,
    width: CROP_HANDLE_SIZE,
    height: CROP_HANDLE_SIZE,
    borderRadius: CROP_HANDLE_SIZE / 2,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
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