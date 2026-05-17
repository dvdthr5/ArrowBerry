import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
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

// ─── SwipeableRow now accepts both onDelete and onEdit ───────────────────────
function SwipeableRow({ children, onDelete, onEdit }) {
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

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PantryScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add modal
  const [modalVisible, setModalVisible] = useState(false);

  // Shopping list modal
  const [shoppingModalVisible, setShoppingModalVisible] = useState(false);
  const [shoppingItems, setShoppingItems] = useState([]);
  const [shoppingItemName, setShoppingItemName] = useState('');
  const [shoppingQuantity, setShoppingQuantity] = useState('');
  const [shoppingUnit, setShoppingUnit] = useState('');

  // Edit modal — these must be INSIDE the component
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Shared form state (used by both add and edit modals)
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [measuringUnit, setMeasuringUnit] = useState('');
  const [category, setCategory] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  // ── Data fetching ──────────────────────────────────────────────────────────
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

  const fetchShoppingItems = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setShoppingItems([]);
      return;
    }

    const { data, error } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) console.error('Error fetching shopping list:', error.message);
    else setShoppingItems(data || []);
  };

  const handleOpenShoppingList = async () => {
    await fetchShoppingItems();
    setShoppingModalVisible(true);
  };

  useEffect(() => {
    fetchItems();
    fetchShoppingItems();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
    fetchShoppingItems();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setItemName('');
    setQuantity('');
    setMeasuringUnit('');
    setCategory('');
    setExpirationDate('');
  };

  const resetShoppingForm = () => {
    setShoppingItemName('');
    setShoppingQuantity('');
    setShoppingUnit('');
  };

  const normalizeUnit = (value) => {
    if (!value) return '';
    return value.trim().toLowerCase().replace(/\s+/g, '');
  };

  const normalizeShoppingItemName = (value) => {
    if (!value) return '';
    return value.trim().toLowerCase().replace(/\s+/g, '');
  };

  const formatShoppingQuantity = (value) => {
    if (value == null || value === '') return '';

    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return String(value);

    return Number.isInteger(numericValue) ? String(numericValue) : String(numericValue);
  };

  const formatShoppingAmount = (item) => {
    const amount = formatShoppingQuantity(item.quantity);
    const unit = item.unit || item.measuringUnit || item.measurement_unit || '';

    if (!amount) {
      return '';
    }

    return unit ? `${amount} ${unit}` : amount;
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

  // ── Add item ───────────────────────────────────────────────────────────────
  const handleAddItem = async () => {
    if (!itemName.trim()) {
      Alert.alert('Missing Info', 'Please enter an item name.');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('pantry_items').insert({
      user_id: user.id,
      item_name: itemName.trim(),
      quantity: quantity.trim() ? parseFloat(quantity.trim()) : null,
      measuringUnit: normalizeUnit(measuringUnit) || null,
      category: category.trim() || null,
      expiration_date: expirationDate.trim() || null,
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setModalVisible(false);
      resetForm();
      fetchItems();
    }
  };

  // ── Shopping list ──────────────────────────────────────────────────────────
  const handleAddShoppingItem = async () => {
    if (!shoppingItemName.trim()) {
      Alert.alert('Missing Info', 'Please enter a shopping list item.');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    const newItemName = shoppingItemName.trim();
    const newItemQuantity = shoppingQuantity.trim() ? parseFloat(shoppingQuantity.trim()) : null;
    const newItemUnit = normalizeUnit(shoppingUnit) || null;
    const normalizedNewItemName = normalizeShoppingItemName(newItemName);

    const { data: existingItems, error: fetchError } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', user.id);

    if (fetchError) {
      setSaving(false);
      Alert.alert('Error', fetchError.message);
      return;
    }

    const matchingItem = (existingItems || []).find((item) => (
      normalizeShoppingItemName(item.item_name) === normalizedNewItemName
    ));

    let error;

    if (matchingItem) {
      const updatedQuantity = (Number(matchingItem.quantity) || 0) + (Number(newItemQuantity) || 0);
      const existingUnit = matchingItem.unit || matchingItem.measuringUnit || matchingItem.measurement_unit || null;

      ({ error } = await supabase
        .from('shopping_list')
        .update({
          quantity: updatedQuantity || null,
          unit: existingUnit || newItemUnit,
        })
        .eq('id', matchingItem.id));
    } else {
      ({ error } = await supabase.from('shopping_list').insert({
        user_id: user.id,
        item_name: newItemName,
        quantity: newItemQuantity,
        unit: newItemUnit,
        checked: false,
      }));
    }

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      resetShoppingForm();
      fetchShoppingItems();
    }
  };

  const handleToggleShoppingItem = async (item) => {
    const nextCheckedValue = !item.checked;

    const { error } = await supabase
      .from('shopping_list')
      .update({ checked: nextCheckedValue })
      .eq('id', item.id);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setShoppingItems((prev) => prev.map((shoppingItem) => (
        shoppingItem.id === item.id ? { ...shoppingItem, checked: nextCheckedValue } : shoppingItem
      )));
    }
  };

  const handleDeleteShoppingItem = async (id) => {
    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .eq('id', id);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setShoppingItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  // ── Delete item ────────────────────────────────────────────────────────────
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

  // ── Edit item ──────────────────────────────────────────────────────────────
  const handleEditPress = (item) => {
    setEditingItem(item);
    setItemName(item.item_name || '');
    setQuantity(item.quantity ? String(item.quantity) : '');
    setMeasuringUnit(item.measuringUnit || '');
    setCategory(item.category || '');
    setExpirationDate(item.expiration_date || '');
    setEditModalVisible(true);
  };

  const handleUpdateItem = async () => {
    if (!itemName.trim()) {
      Alert.alert('Missing Info', 'Please enter an item name.');
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('pantry_items')
      .update({
        item_name: itemName.trim(),
        quantity: quantity ? parseFloat(quantity) : null,
        measuringUnit: normalizeUnit(measuringUnit) || null,
        category: category || null,
        expiration_date: expirationDate || null,
      })
      .eq('id', editingItem.id);

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setEditModalVisible(false);
      setEditingItem(null);
      resetForm();
      fetchItems();
    }
  };

  // ── Render each pantry card ────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const expiry = getExpiryStatus(item.expiration_date);
    return (
      <SwipeableRow
        onDelete={() => handleDeleteItem(item.id)}
        onEdit={() => handleEditPress(item)}
      >
        {/* Single card — removed the accidental double-nested card */}
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
      </SwipeableRow>
    );
  };

  // ── Form fields shared between add and edit modals ─────────────────────────
  const renderFormFields = () => (
    <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">

      <Text style={styles.label}>Item Name <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Chicken Breast"
        placeholderTextColor="#aaa"
        value={itemName}
        onChangeText={setItemName}
      />

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

      <Text style={styles.label}>Expiration Date</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#aaa"
        value={expirationDate}
        onChangeText={setExpirationDate}
        keyboardType="numbers-and-punctuation"
      />

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
  );

  const renderShoppingItem = (item) => {
    const quantityText = formatShoppingAmount(item);

    return (
      <View key={item.id} style={styles.shoppingLine}>
        <TouchableOpacity
          testID={`shopping-checkbox-${item.id}`}
          style={[styles.shoppingCheckbox, item.checked && styles.shoppingCheckboxActive]}
          onPress={() => handleToggleShoppingItem(item)}
        >
          {item.checked && <View style={styles.shoppingCheckboxDot} />}
        </TouchableOpacity>
        <View style={styles.shoppingLineTextContainer}>
          <Text style={[styles.shoppingItemText, item.checked && styles.shoppingItemTextChecked]}>
            {item.item_name}
          </Text>
          {quantityText ? <Text style={styles.shoppingQuantityText}>{quantityText}</Text> : null}
        </View>
        <TouchableOpacity onPress={() => handleDeleteShoppingItem(item.id)}>
          <Text style={styles.shoppingDeleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading your pantry...</Text>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Pantry</Text>
        <Text style={styles.headerSubtitle}>{items.length} items stored</Text>
      </View>

      {/* List or empty state */}
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />
          }
        />
      )}

      {/* Floating Buttons */}
      <TouchableOpacity style={styles.shoppingFab} onPress={handleOpenShoppingList}>
        <Text style={styles.shoppingFabText}>List</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* ── Add Item Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setModalVisible(false); resetForm(); }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Item</Text>
              <TouchableOpacity onPress={handleAddItem} disabled={saving}>
                {saving ? <ActivityIndicator color="#4CAF50" /> : <Text style={styles.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
            {renderFormFields()}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Shopping List Modal ── */}
      <Modal
        visible={shoppingModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShoppingModalVisible(false); resetShoppingForm(); }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShoppingModalVisible(false); resetShoppingForm(); }}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Shopping List</Text>
              <TouchableOpacity testID="shopping-add-button" onPress={handleAddShoppingItem} disabled={saving}>
                {saving ? <ActivityIndicator color="#4CAF50" /> : <Text style={styles.saveText}>Add</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.shoppingPaper} keyboardShouldPersistTaps="handled">
              <View style={styles.shoppingInputRow}>
                <TextInput
                  style={styles.shoppingNameInput}
                  placeholder="Item"
                  placeholderTextColor="#9C8F7A"
                  value={shoppingItemName}
                  onChangeText={setShoppingItemName}
                />
                <TextInput
                  style={styles.shoppingSmallInput}
                  placeholder="Qty"
                  placeholderTextColor="#9C8F7A"
                  keyboardType="decimal-pad"
                  value={shoppingQuantity}
                  onChangeText={setShoppingQuantity}
                />
                <TextInput
                  style={styles.shoppingSmallInput}
                  placeholder="Unit"
                  placeholderTextColor="#9C8F7A"
                  value={shoppingUnit}
                  onChangeText={setShoppingUnit}
                />
              </View>

              {shoppingItems.length === 0 ? (
                <View style={styles.shoppingEmptyContainer}>
                  <Text style={styles.shoppingEmptyText}>No shopping list items yet.</Text>
                </View>
              ) : (
                shoppingItems.map(renderShoppingItem)
              )}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Item Modal ── */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setEditModalVisible(false); setEditingItem(null); resetForm(); }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setEditModalVisible(false); setEditingItem(null); resetForm(); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Item</Text>
              <TouchableOpacity onPress={handleUpdateItem} disabled={saving}>
                {saving ? <ActivityIndicator color="#4CAF50" /> : <Text style={styles.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
            {renderFormFields()}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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

  // Floating button
  fab: {
    position: 'absolute', bottom: 28, right: 24,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  fabIcon: { fontSize: 32, color: '#fff', lineHeight: 36 },
  shoppingFab: {
    position: 'absolute', bottom: 96, right: 24,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  shoppingFabText: { fontSize: 14, color: '#fff', fontWeight: '800' },
  // Swipe actions
  swipeActions: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  editAction: {
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginRight: 6,
    gap: 4,
  },
  deleteAction: {
    backgroundColor: '#e53935',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    gap: 4,
  },
  actionIcon: { fontSize: 20 },
  actionText: { color: '#fff', fontSize: 11, fontWeight: '700' },

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

  shoppingPaper: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 60,
    backgroundColor: '#FFFDF4',
    flexGrow: 1,
  },
  shoppingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#B7D7F0',
    paddingBottom: 8,
    marginBottom: 8,
  },
  shoppingNameInput: {
    flex: 1,
    fontSize: 16,
    color: '#1B3A1F',
    paddingVertical: 8,
  },
  shoppingSmallInput: {
    width: 72,
    fontSize: 15,
    color: '#1B3A1F',
    paddingVertical: 8,
    textAlign: 'center',
  },
  shoppingLine: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#B7D7F0',
    paddingVertical: 6,
  },
  shoppingCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  shoppingCheckboxActive: {
    backgroundColor: '#E7F3E7',
  },
  shoppingCheckboxDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },
  shoppingLineTextContainer: {
    flex: 1,
  },
  shoppingItemText: {
    fontSize: 16,
    color: '#1B3A1F',
    fontWeight: '600',
  },
  shoppingItemTextChecked: {
    color: '#8A8A8A',
    textDecorationLine: 'line-through',
  },
  shoppingQuantityText: {
    fontSize: 12,
    color: '#7A9A7E',
    marginTop: 2,
  },
  shoppingDeleteText: {
    fontSize: 12,
    color: '#e53935',
    fontWeight: '700',
    paddingLeft: 10,
  },
  shoppingEmptyContainer: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shoppingEmptyText: {
    color: '#9C8F7A',
    fontSize: 15,
    fontWeight: '500',
  },
});