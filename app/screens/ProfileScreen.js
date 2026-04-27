import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Real Database State
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [fetchingRecipes, setFetchingRecipes] = useState(true);

  // Local state for Dietary Restrictions (MVP visualization)
  const [dietary, setDietary] = useState({
    halal: false, vegetarian: false, vegan: false,
    kosher: false, nutAllergy: false, dairyAllergy: false, glutenFree: false,
  });

  // useFocusEffect runs every time the user navigates to this tab
  useFocusEffect(
    useCallback(() => {
      const loadProfileData = async () => {
        setFetchingRecipes(true);
        const { data: authData } = await supabase.auth.getUser();
        
        if (authData?.user) {
          setEmail(authData.user.email);
          
          // Fetch real saved recipes from database
          const { data: recipes, error } = await supabase
            .from('saved_recipes')
            .select('*')
            .eq('user_id', authData.user.id)
            .order('created_at', { ascending: false });
            
          if (!error && recipes) {
            setSavedRecipes(recipes);
          }
        }
        setFetchingRecipes(false);
      };
      
      loadProfileData();
    }, [])
  );

  const handlePasswordReset = async () => {
    if (!email) return Alert.alert("Error", "No user email found.");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Check your inbox", "Password reset link has been sent!");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const toggleDietary = (key) => {
    setDietary(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatLabel = (key) => {
    const result = key.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headerTitle}>Profile</Text>

      {/* --- Account Details --- */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        <Text style={styles.emailText}>{email ? email : 'Loading email...'}</Text>
        
        <View style={styles.buttonRow}>
          <View style={styles.buttonWrapper}>
            <Button title="Reset Password" onPress={handlePasswordReset} disabled={loading} color="#007bff" />
          </View>
          <View style={styles.buttonWrapper}>
            <Button title="Sign Out" onPress={handleSignOut} color="#dc3545" />
          </View>
        </View>
      </View>

      {/* --- Saved Recipes --- */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Saved Recipes</Text>
        
        {fetchingRecipes ? (
          <ActivityIndicator size="small" color="#007bff" />
        ) : savedRecipes.length > 0 ? (
          savedRecipes.map((recipe) => (
            <View key={recipe.id} style={styles.recipeItem}>
              <Text style={styles.recipeTitle}>{recipe.recipe_title}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No saved recipes yet.</Text>
        )}
      </View>

      {/* --- Dietary Restrictions --- */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Dietary Restrictions</Text>
        
        {Object.keys(dietary).map((key) => (
          <View key={key} style={styles.switchRow}>
            <Text style={styles.switchLabel}>{formatLabel(key)}</Text>
            <Switch
              value={dietary[key]}
              onValueChange={() => toggleDietary(key)}
              trackColor={{ false: "#e0e0e0", true: "#81b0ff" }}
              thumbColor={dietary[key] ? "#007bff" : "#f4f3f4"}
            />
          </View>
        ))}
      </View>
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#f8f9fa' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, marginTop: 40, color: '#333' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10, marginBottom: 15, color: '#333' },
  emailText: { fontSize: 16, color: '#555', marginBottom: 15 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  buttonWrapper: { flex: 1, marginHorizontal: 5 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  switchLabel: { fontSize: 16, color: '#444' },
  recipeItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 15, borderRadius: 8, marginBottom: 10 },
  recipeTitle: { fontSize: 16, fontWeight: '500', color: '#333' },
  emptyText: { fontStyle: 'italic', color: '#888' }
});