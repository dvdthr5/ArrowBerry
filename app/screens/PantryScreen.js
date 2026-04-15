import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function PantryScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .order('item_name', { ascending: true });

    if (error) {
      console.error('Error fetching pantry items:', error.message);
    } else {
      setItems(data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
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
      <View style={styles.card}>

        {/* Image Section */}
        <View style={styles.imageContainer}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>🛒</Text>
            </View>
          )}
        </View>

        {/* Content Section */}
        <View style={styles.content}>

          {/* Item Name */}
          <Text style={styles.itemName}>{item.item_name}</Text>

          {/* Category Badge */}
          {item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          )}

          {/* Quantity + Unit Row */}
          <View style={styles.row}>
            <View style={styles.quantityBox}>
              <Text style={styles.quantityNumber}>{item.quantity}</Text>
              <Text style={styles.quantityUnit}>{item.measuringUnit ?? item.measuring_unit}</Text>
            </View>

            {/* Expiry Badge */}
            <View style={[styles.expiryBadge, { borderColor: expiry.color }]}>
              <View style={[styles.expiryDot, { backgroundColor: expiry.color }]} />
              <Text style={[styles.expiryText, { color: expiry.color }]}>{expiry.label}</Text>
            </View>
          </View>

        </View>
      </View>
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
          <Text style={styles.emptySubtext}>Scan a receipt to add items!</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F2',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#888',
    fontSize: 15,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#F5F7F2',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E5DA',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1B3A1F',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#7A9A7E',
    marginTop: 2,
  },

  // List
  list: {
    padding: 16,
    gap: 12,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },

  // Image
  imageContainer: {
    width: 90,
    backgroundColor: '#EEF3EB',
    justifyContent: 'center',
  },
  image: {
    width: 90,
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  imagePlaceholderText: {
    fontSize: 32,
  },

  // Content
  content: {
    flex: 1,
    padding: 12,
    gap: 4,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B3A1F',
    letterSpacing: -0.3,
  },

  // Category
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF3EB',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4CAF50',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Quantity Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  quantityBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  quantityNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1B3A1F',
  },
  quantityUnit: {
    fontSize: 13,
    fontWeight: '500',
    color: '#7A9A7E',
  },

  // Expiry
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  expiryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  expiryText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Empty State
  emptyIcon: {
    fontSize: 60,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B3A1F',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#7A9A7E',
    marginTop: 6,
  },
});