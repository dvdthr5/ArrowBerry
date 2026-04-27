import React, { useEffect, useState } from 'react';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl, SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';

const CATEGORIES = ['Produce', 'Dairy', 'Meat', 'Seafood', 'Grains', 'Frozen', 'Snacks', 'Beverages', 'Condiments', 'Other'];
const UNITS = ['g', 'kg', 'oz', 'lb', 'ml', 'L', 'tsp', 'tbsp', 'cup', 'pcs', 'pack'];

function SwipeableRow({ children, onDelete }) {
  const renderRightActions = () => (
    <TouchableOpacity style={styles.deleteAction} onPress={onDelete}>
      <Text style={styles.deleteIcon}>🗑️</Text>
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
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

export default function PantryScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [measuringUnit, setMeasuringUnit] = useState('');
  const [category, setCategory] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .order('item_name', { ascending: true });

    if (error) console.error('Error fetching pantry items:', error.message);
    else setItems(data);

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchItems(); };

  const resetForm = () => {
    setItemName('');
    setQuantity('');
    setMeasuringUnit('');
    setCategory('');
    setExpirationDate('');
  };

  const normalizeUnit = (value) => {
    if (!value) return '';
    return value.trim().toLowerCase().replace(/\s+/g, '');
  };

  const handleAddItem = async () => {

    if (!itemName.trim()) {
      Alert.alert('Missing Info', 'Please enter an item name.');
      return;
    }

    setSaving(true);

    const normalizedItemName = itemName.trim();
    const normalizedQuantity = quantity.trim() ? parseFloat(quantity.trim()) : null;
    const normalizedMeasuringUnit = normalizeUnit(measuringUnit) || null;
    const normalizedCategory = category.trim() || null;
    const normalizedExpirationDate = expirationDate.trim() || null;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('pantry_items').insert({
      user_id: user.id,           // links to the logged in user
      item_name: normalizedItemName,
      quantity: normalizedQuantity,
      measuringUnit: normalizedMeasuringUnit,
      category: normalizedCategory,
      expiration_date: normalizedExpirationDate,
      // id and created_at are auto-filled by Supabase
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setModalVisible(false);
      resetForm();
      fetchItems(); // refresh the list
    }
  };

  const handleDeleteItem = async (id) => {
    const { error } = await supabase
      .from('pantry_items')
      .delete()
      .eq('id', id);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const getExpiryStatus = (dateStr) => {
    if (!dateStr) return { label: 'No expiry', color: '#aaa' };
    const today = new Date();
    const expiry = new Date(dateStr);
    const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: 'Expired', color: '#e53935' };
    if (daysLeft <= 3) return { label: `Expires in ${daysLeft}d`, color: '#FB8C00' };
    if (daysLeft <= 7) return { label: `Expires in ${daysLeft}d`, color: '#FDD835' };
    return { label: `Expires ${expiry.toLocaleDateString()}`, color: '#43A047' };
  };


  const renderItem = ({ item }) => {
    const expiry = getExpiryStatus(item.expiration_date);
    return (
      <SwipeableRow onDelete={() => handleDeleteItem(item.id)}>
        <View style={styles.card}>
          <View style={styles.card}>
            <View style={styles.imageContainer}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.image} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>🛒</Text>
                </View>
              )}
            </View>
            <View style={styles.content}>
              <Text style={styles.itemName}>{item.item_name}</Text>
              {item.category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{item.category}</Text>
                </View>
              )}
              <View style={styles.row}>
                <View style={styles.quantityBox}>
                  <Text style={styles.quantityNumber}>{item.quantity}</Text>
                  <Text style={styles.quantityUnit}>{item.measuringUnit ?? item.measuring_unit}</Text>
                </View>
                <View style={[styles.expiryBadge, { borderColor: expiry.color }]}>
                  <View style={[styles.expiryDot, { backgroundColor: expiry.color }]} />
                  <Text style={[styles.expiryText, { color: expiry.color }]}>{expiry.label}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </SwipeableRow>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading your pantry...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Pantry</Text>
        <Text style={styles.headerSubtitle}>{items.length} items stored</Text>
      </View>

      {/* List */}
      {items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🧺</Text>
          <Text style={styles.emptyText}>Your pantry is empty</Text>
          <Text style={styles.emptySubtext}>Tap + to add your first item!</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />}
        />
      )}

      {/* Floating + Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Add Item Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setModalVisible(false); resetForm(); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={styles.modalContainer}>

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Item</Text>
              <TouchableOpacity onPress={handleAddItem} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#4CAF50" />
                  : <Text style={styles.saveText}>Save</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">

              {/* Item Name */}
              <Text style={styles.label}>Item Name <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Chicken Breast"
                placeholderTextColor="#aaa"
                value={itemName}
                onChangeText={setItemName}
              />

              {/* Quantity + Unit side by side */}
              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2"
                    placeholderTextColor="#aaa"
                    keyboardType="decimal-pad"
                    value={quantity}
                    onChangeText={setQuantity}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Unit</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. kg"
                    placeholderTextColor="#aaa"
                    value={measuringUnit}
                    onChangeText={setMeasuringUnit}
                  />
                </View>
              </View>

              {/* Quick Unit Selector */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {UNITS.map((u) => {
                  const isSelected = normalizeUnit(measuringUnit) === normalizeUnit(u);

                  return (
                    <TouchableOpacity
                      key={u}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => setMeasuringUnit(u)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Expiration Date */}
              <Text style={styles.label}>Expiration Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#aaa"
                value={expirationDate}
                onChangeText={setExpirationDate}
                keyboardType="numbers-and-punctuation"
              />

              {/* Category */}
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7F2' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#888', fontSize: 15 },

  header: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    backgroundColor: '#F5F7F2', borderBottomWidth: 1, borderBottomColor: '#E0E5DA',
  },
  headerTitle: { fontSize: 30, fontWeight: '800', color: '#1B3A1F', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: '#7A9A7E', marginTop: 2 },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, flexDirection: 'row',
    overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, marginBottom: 12, width: '100%',
  },
  imageContainer: { width: 90, backgroundColor: '#EEF3EB', justifyContent: 'center' },
  image: { width: 90, height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { width: 90, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  imagePlaceholderText: { fontSize: 32 },
  content: { flex: 1, padding: 12, gap: 4 },
  itemName: { fontSize: 18, fontWeight: '800', color: '#1B3A1F', letterSpacing: -0.3 },
  categoryBadge: {
    alignSelf: 'flex-start', backgroundColor: '#EEF3EB',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
  },
  categoryText: { fontSize: 11, fontWeight: '600', color: '#4CAF50', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  quantityBox: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  quantityNumber: { fontSize: 22, fontWeight: '800', color: '#1B3A1F' },
  quantityUnit: { fontSize: 13, fontWeight: '500', color: '#7A9A7E' },
  expiryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  expiryDot: { width: 7, height: 7, borderRadius: 4 },
  expiryText: { fontSize: 11, fontWeight: '700' },
  emptyIcon: { fontSize: 60, marginBottom: 12 },
  emptyText: { fontSize: 20, fontWeight: '700', color: '#1B3A1F' },
  emptySubtext: { fontSize: 14, color: '#7A9A7E', marginTop: 6 },

  // Floating Button
  fab: {
    position: 'absolute', bottom: 28, right: 24,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  fabIcon: { fontSize: 32, color: '#fff', lineHeight: 36 },

  // Modal
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

  label: { fontSize: 13, fontWeight: '600', color: '#1B3A1F', marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.4 },
  required: { color: '#e53935' },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    fontSize: 15, borderWidth: 1, borderColor: '#E0E5DA', color: '#1B3A1F',
  },
  rowInputs: { flexDirection: 'row' },

  // Unit chips
  chipRow: { marginTop: 10, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E5DA', marginRight: 8,
  },
  chipActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  // Category grid
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E5DA',
  },
  categoryChipActive: { backgroundColor: '#EEF3EB', borderColor: '#4CAF50' },
  categoryChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  categoryChipTextActive: { color: '#4CAF50', fontWeight: '700' },
deleteAction: {
    backgroundColor: '#e53935',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginBottom: 12,
    gap: 4,
  },
  deleteIcon: {
    fontSize: 20,
  },
  deleteText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

});
