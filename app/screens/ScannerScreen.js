import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const CATEGORIES = ['Produce', 'Dairy', 'Meat', 'Seafood', 'Grains', 'Frozen', 'Snacks', 'Beverages', 'Condiments', 'Other'];
const UNITS = ['g', 'kg', 'oz', 'lb', 'ml', 'L', 'tsp', 'tbsp', 'cup', 'pcs', 'pack'];

const CATEGORY_ICONS = {
  Produce: '🥦', Dairy: '🥛', Meat: '🥩', Seafood: '🐟',
  Grains: '🌾', Frozen: '🧊', Snacks: '🍿', Beverages: '🧃',
  Condiments: '🫙', Other: '📦',
};

// ── Swipeable row for result items ────────────────────────────────────────────
function SwipeableResultRow({ children, onDelete, onEdit }) {
  const renderRightActions = () => (
    <View style={styles.swipeActions}>
      <TouchableOpacity style={styles.editAction} onPress={onEdit}>
        <Text style={styles.actionIcon}>✏️</Text>
        <Text style={styles.actionText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteAction} onPress={onDelete}>
        <Text style={styles.actionIcon}>🗑️</Text>
        <Text style={styles.actionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      containerStyle={{ width: '100%' }}
    >
      {children}
    </Swipeable>
  );
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [screen, setScreen] = useState('camera');
  const [imageUri, setImageUri] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [parsedItems, setParsedItems] = useState([]);
  const [saving, setSaving] = useState(false);

  // Edit modal state for result items
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editExpiry, setEditExpiry] = useState('');

  // ── Permission gates ─────────────────────────────────────────────────────
  if (!permission) return <View style={styles.fill} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionSubtitle}>
          ArrowBerry needs your camera to scan grocery receipts.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Take picture ─────────────────────────────────────────────────────────
  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      setImageUri(photo.uri);
      setBase64Image(photo.base64);
      setScreen('preview');
    } catch {
      Alert.alert('Camera Error', 'Failed to take picture. Please try again.');
    }
  };

  // ── Retake ───────────────────────────────────────────────────────────────
  const retake = () => {
    setImageUri(null);
    setBase64Image(null);
    setParsedItems([]);
    setScreen('camera');
  };

  // ── Analyze with Gemini ──────────────────────────────────────────────────
  const analyzeReceipt = async () => {
    if (!base64Image) return;
    setScreen('loading');

    try {
      const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `You are a grocery receipt parser. Extract all food items from this receipt and return ONLY a valid JSON array. No markdown, no explanation, just the raw JSON array.

Today's date is ${new Date().toISOString().split('T')[0]}.

For each item return an object with these exact keys:
- "item_name": string, the name of the food item
- "quantity": integer only, the whole number amount (round any decimals, default to 1 if unclear)
- "measuringUnit": string, the unit (g, kg, oz, lb, ml, L, tsp, tbsp, cup, pcs, pack — pick the most appropriate, default to "pcs" if unclear)
- "category": string, must be exactly one of: Produce, Dairy, Meat, Seafood, Grains, Frozen, Snacks, Beverages, Condiments, Other
- "expiration_date": string in YYYY-MM-DD format, estimate based on today's date how long this item typically lasts

Example output:
[
  {"item_name":"Whole Milk","quantity":1,"measuringUnit":"L","category":"Dairy","expiration_date":"2026-05-25"},
  {"item_name":"Chicken Breast","quantity":2,"measuringUnit":"lb","category":"Meat","expiration_date":"2026-05-20"}
]`,
              },
              { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
            ],
          }],
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const candidate = data.candidates?.[0];
      if (!candidate?.content?.parts) throw new Error("Couldn't read the receipt. Try a clearer photo.");

      const textOutput = candidate.content.parts[0].text;
      const cleaned = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      const items = JSON.parse(cleaned);

      setParsedItems(items);
      setScreen('results');
    } catch (error) {
      Alert.alert('Analysis Failed', error.message || 'Try a clearer photo.');
      setScreen('preview');
    }
  };

  // ── Delete a result item ─────────────────────────────────────────────────
  const handleDeleteResultItem = (index) => {
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Open edit modal for a result item ────────────────────────────────────
  const handleEditResultPress = (item, index) => {
    setEditingIndex(index);
    setEditName(item.item_name || '');
    setEditQuantity(item.quantity ? String(item.quantity) : '');
    setEditUnit(item.measuringUnit || '');
    setEditCategory(item.category || '');
    setEditExpiry(item.expiration_date || '');
    setEditModalVisible(true);
  };

  // ── Save edited result item (updates in-memory array only) ───────────────
  const handleSaveResultEdit = () => {
    if (!editName.trim()) {
      Alert.alert('Missing Info', 'Please enter an item name.');
      return;
    }

    setParsedItems((prev) =>
      prev.map((item, i) =>
        i === editingIndex
          ? {
              ...item,
              item_name: editName.trim(),
              quantity: editQuantity ? Math.round(Number(editQuantity)) : 1,
              measuringUnit: editUnit || 'pcs',
              category: CATEGORIES.includes(editCategory) ? editCategory : 'Other',
              expiration_date: editExpiry || null,
            }
          : item
      )
    );

    setEditModalVisible(false);
    setEditingIndex(null);
  };

  // ── Save all items to Supabase ───────────────────────────────────────────
  const saveToDatabase = async () => {
    setSaving(true);
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData?.user) throw new Error('You must be logged in to save.');

      const insertData = parsedItems.map(item => ({
        user_id: userData.user.id,
        item_name: item.item_name,
        quantity: Math.round(Number(item.quantity)) || 1,
        measuringUnit: item.measuringUnit || 'pcs',
        category: CATEGORIES.includes(item.category) ? item.category : 'Other',
        expiration_date: item.expiration_date || null,
      }));

      const { error: dbError } = await supabase.from('pantry_items').insert(insertData);
      if (dbError) throw dbError;

      Alert.alert('Saved!', `${insertData.length} items added to your pantry.`);
      retake();
    } catch (error) {
      Alert.alert('Save Failed', error.message);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN: camera
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'camera') {
    return (
      <View style={styles.fill}>
        <CameraView style={styles.fill} facing="back" ref={cameraRef} />
        <SafeAreaView style={styles.cameraTopHint} pointerEvents="none">
          <View style={styles.hintPill}>
            <Text style={styles.hintText}>Point at a grocery receipt</Text>
          </View>
        </SafeAreaView>
        <View style={styles.captureRow}>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture} activeOpacity={0.8}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN: preview
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'preview') {
    return (
      <View style={styles.fill}>
        <Image source={{ uri: imageUri }} style={styles.fill} resizeMode="cover" />
        <View style={styles.previewOverlay} />

        {/* X retake button — inset further from corner */}
        <SafeAreaView style={styles.previewTopBar}>
          <TouchableOpacity style={styles.retakeButton} onPress={retake}>
            <Text style={styles.retakeIcon}>✕</Text>
          </TouchableOpacity>
        </SafeAreaView>

        <View style={styles.previewLabelContainer} pointerEvents="none">
          <Text style={styles.previewLabel}>Looks good?</Text>
          <Text style={styles.previewSublabel}>Tap ✓ to extract items</Text>
        </View>

        <View style={styles.captureRow}>
          <TouchableOpacity style={styles.confirmButton} onPress={analyzeReceipt} activeOpacity={0.85}>
            <Text style={styles.confirmIcon}>✓</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN: loading
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'loading') {
    return (
      <View style={styles.fill}>
        <Image source={{ uri: imageUri }} style={[styles.fill, { opacity: 0.25 }]} resizeMode="cover" />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingTitle}>Analyzing receipt…</Text>
          <Text style={styles.loadingSubtitle}>Gemini is reading your items</Text>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN: results
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.resultsScreen}>

      <View style={styles.resultsHeader}>
        <TouchableOpacity onPress={retake} style={styles.resultsBackButton}>
          <Text style={styles.resultsBackText}>✕ Discard</Text>
        </TouchableOpacity>
        <Text style={styles.resultsTitle}>{parsedItems.length} Items Found</Text>
        <View style={{ width: 80 }} />
      </View>

      <Text style={styles.swipeHint}>← Swipe left to edit or delete</Text>

      <ScrollView contentContainerStyle={styles.resultsList} showsVerticalScrollIndicator={false}>
        {parsedItems.map((item, index) => (
          <SwipeableResultRow
            key={index}
            onDelete={() => handleDeleteResultItem(index)}
            onEdit={() => handleEditResultPress(item, index)}
          >
            <View style={styles.resultCard}>
              <View style={styles.resultCardLeft}>
                <Text style={styles.resultCardIcon}>
                  {CATEGORY_ICONS[item.category] || '📦'}
                </Text>
                <View>
                  <Text style={styles.resultCardName}>{item.item_name}</Text>
                  <View style={styles.resultCategoryBadge}>
                    <Text style={styles.resultCategoryText}>{item.category}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.resultCardRight}>
                <Text style={styles.resultQty}>
                  {item.quantity}
                  <Text style={styles.resultUnit}> {item.measuringUnit}</Text>
                </Text>
                <Text style={styles.resultExpiry}>exp {item.expiration_date ?? '—'}</Text>
              </View>
            </View>
          </SwipeableResultRow>
        ))}
      </ScrollView>

      <View style={styles.saveContainer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveToDatabase}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveButtonText}>Add {parsedItems.length} items to Pantry →</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── Edit Result Item Modal ── */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setEditModalVisible(false); setEditingIndex(null); }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setEditModalVisible(false); setEditingIndex(null); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Item</Text>
              <TouchableOpacity onPress={handleSaveResultEdit}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">

              <Text style={styles.label}>Item Name <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Chicken Breast"
                placeholderTextColor="#aaa"
                value={editName}
                onChangeText={setEditName}
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2"
                    placeholderTextColor="#aaa"
                    keyboardType="decimal-pad"
                    value={editQuantity}
                    onChangeText={setEditQuantity}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Unit</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. kg"
                    placeholderTextColor="#aaa"
                    value={editUnit}
                    onChangeText={setEditUnit}
                  />
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.chip, editUnit === u && styles.chipActive]}
                    onPress={() => setEditUnit(u)}
                  >
                    <Text style={[styles.chipText, editUnit === u && styles.chipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Expiration Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#aaa"
                value={editExpiry}
                onChangeText={setEditExpiry}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, editCategory === cat && styles.categoryChipActive]}
                    onPress={() => setEditCategory(cat)}
                  >
                    <Text style={[styles.categoryChipText, editCategory === cat && styles.categoryChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },

  // ── Permission screen ──
  permissionScreen: {
    flex: 1, backgroundColor: '#F5F7F2',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  permissionIcon: { fontSize: 56, marginBottom: 16 },
  permissionTitle: { fontSize: 22, fontWeight: '800', color: '#1B3A1F', marginBottom: 8 },
  permissionSubtitle: { fontSize: 15, color: '#7A9A7E', textAlign: 'center', marginBottom: 28 },
  permissionButton: {
    backgroundColor: '#4CAF50', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14,
  },
  permissionButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // ── Camera ──
  cameraTopHint: {
    position: 'absolute', top: 0, left: 0, right: 0,
    alignItems: 'center', paddingTop: 12,
  },
  hintPill: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
  },
  hintText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  captureRow: {
    position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center',
  },
  captureButton: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },

  // ── Preview ──
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  previewTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 28,  // ← inset from edge
    paddingTop: 20,         // ← pushed down from top
  },
  retakeButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  retakeIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
  previewLabelContainer: {
    position: 'absolute', bottom: 120, left: 0, right: 0, alignItems: 'center',
  },
  previewLabel: { color: '#fff', fontSize: 22, fontWeight: '800' },
  previewSublabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 },
  confirmButton: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#4CAF50',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  confirmIcon: { color: '#fff', fontSize: 32, fontWeight: '800' },

  // ── Loading ──
  loadingContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  loadingTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 4 },
  loadingSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },

  // ── Results ──
  resultsScreen: { flex: 1, backgroundColor: '#F5F7F2' },
  resultsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E5DA',
  },
  resultsTitle: { fontSize: 17, fontWeight: '800', color: '#1B3A1F' },
  resultsBackButton: { width: 80 },
  resultsBackText: { fontSize: 14, color: '#e53935', fontWeight: '600' },

  swipeHint: {
    textAlign: 'center', fontSize: 12, color: '#7A9A7E',
    paddingVertical: 8, backgroundColor: '#F5F7F2',
  },

  resultsList: { padding: 16, paddingBottom: 32 },
  resultCard: {
    backgroundColor: '#fff', borderRadius: 14,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 10, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  resultCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  resultCardIcon: { fontSize: 28 },
  resultCardName: { fontSize: 15, fontWeight: '700', color: '#1B3A1F', marginBottom: 4 },
  resultCategoryBadge: {
    alignSelf: 'flex-start', backgroundColor: '#EEF3EB',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  resultCategoryText: { fontSize: 10, fontWeight: '600', color: '#4CAF50', textTransform: 'uppercase' },
  resultCardRight: { alignItems: 'flex-end' },
  resultQty: { fontSize: 18, fontWeight: '800', color: '#1B3A1F' },
  resultUnit: { fontSize: 12, fontWeight: '500', color: '#7A9A7E' },
  resultExpiry: { fontSize: 11, color: '#7A9A7E', marginTop: 2 },

  // ── Swipe actions ──
  swipeActions: { flexDirection: 'row', marginBottom: 10 },
  editAction: {
    backgroundColor: '#1976D2', justifyContent: 'center', alignItems: 'center',
    width: 80, borderRadius: 14, marginRight: 6, gap: 4,
  },
  deleteAction: {
    backgroundColor: '#e53935', justifyContent: 'center', alignItems: 'center',
    width: 80, borderRadius: 14, gap: 4,
  },
  actionIcon: { fontSize: 20 },
  actionText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // ── Save button ──
  saveContainer: {
    paddingHorizontal: 20, paddingBottom: 16, paddingTop: 10,
    backgroundColor: '#F5F7F2', borderTopWidth: 1, borderTopColor: '#E0E5DA',
  },
  saveButton: {
    backgroundColor: '#4CAF50', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },

  // ── Edit modal ──
  modalContainer: { flex: 1, backgroundColor: '#F5F7F2' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#E0E5DA', backgroundColor: '#fff',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1B3A1F' },
  cancelText: { fontSize: 15, color: '#888', fontWeight: '500' },
  saveText: { fontSize: 15, color: '#4CAF50', fontWeight: '700' },
  modalBody: { padding: 20, paddingBottom: 60 },
  label: {
    fontSize: 13, fontWeight: '600', color: '#1B3A1F',
    marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  required: { color: '#e53935' },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    fontSize: 15, borderWidth: 1, borderColor: '#E0E5DA', color: '#1B3A1F',
  },
  rowInputs: { flexDirection: 'row' },
  chipRow: { marginTop: 10, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E5DA', marginRight: 8,
  },
  chipActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E5DA',
  },
  categoryChipActive: { backgroundColor: '#EEF3EB', borderColor: '#4CAF50' },
  categoryChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  categoryChipTextActive: { color: '#4CAF50', fontWeight: '700' },
});