import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Switch, Text, View, Pressable, Modal, Image } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Real Database State
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [fetchingRecipes, setFetchingRecipes] = useState(true);

  // Modal State (Matches RecipesScreen)
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedRecipeIngredients, setSelectedRecipeIngredients] = useState([]);

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

  // --- NEW: Handle opening the saved recipe modal ---
  async function handleRecipePress(savedRecipeItem) {
    // 1. Fetch the full recipe details using the saved recipe_id
    const { data: recipeData, error: recipeError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', savedRecipeItem.recipe_id)
      .single();

    if (recipeError || !recipeData) {
      Alert.alert("Error", "Could not load recipe details.");
      return;
    }
    setSelectedRecipe(recipeData);

    // 2. Fetch the ingredients for this recipe
    const { data: ingredientsData, error: ingredientsError } = await supabase
      .from('recipe_ingredients')
      .select('quantity, unit, ingredient_name')
      .eq('recipe_id', savedRecipeItem.recipe_id);

    if (ingredientsError) {
      console.error('Failed to fetch recipe ingredients', ingredientsError.message);
      setSelectedRecipeIngredients([]);
    } else {
      setSelectedRecipeIngredients(ingredientsData || []);
    }
  }

  async function handleUnsaveRecipe(savedRecordId) {
    // 1. Optimistically remove it from the screen immediately for a snappy feel
    setSavedRecipes(currentRecipes => currentRecipes.filter(r => r.id !== savedRecordId));

    // 2. Delete it from the database behind the scenes
    const { error } = await supabase
      .from('saved_recipes')
      .delete()
      .eq('id', savedRecordId);

    if (error) {
      Alert.alert("Error", "Could not remove the recipe from the database.");
    }
  }

  function handleCloseRecipeModal() {
    setSelectedRecipe(null);
    setSelectedRecipeIngredients([]);
  }

  function formatRecipeInstructions(instructions) {
    if (!instructions) return '';
    return instructions.replace(/\s*(\d+\.)\s/g, '\n$1 ').trim();
  }

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
    <View style={styles.mainContainer}>
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
              <View key={recipe.id} style={styles.recipeItemContainer}>
                <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.recipe_title}</Text>
                
                <View style={styles.recipeActionButtons}>
                  <Pressable style={styles.viewButton} onPress={() => handleRecipePress(recipe)}>
                    <Text style={styles.viewButtonText}>View</Text>
                  </Pressable>
                  
                  <Pressable style={styles.unsaveButton} onPress={() => handleUnsaveRecipe(recipe.id)}>
                    <Text style={styles.unsaveButtonText}>Unsave</Text>
                  </Pressable>
                </View>
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

      {/* --- NEW: Recipe Details Modal --- */}
      <Modal 
        visible={!!selectedRecipe} 
        transparent={true} 
        animationType='fade'
        onRequestClose={handleCloseRecipeModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={handleCloseRecipeModal} />
          <View style={styles.modalCard}>
            {selectedRecipe && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.recipeDetailsTitle}>{selectedRecipe.title}</Text>
                  <Pressable style={styles.modalCloseButton} onPress={handleCloseRecipeModal}>
                    <Text style={styles.modalCloseButtonText}>Close</Text>
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {!!selectedRecipe.image_url && (
                    <Image
                      source={{ uri: selectedRecipe.image_url }}
                      style={styles.recipeImage}
                      resizeMode="cover"
                    />
                  )}
                  {!!selectedRecipeIngredients.length && (
                    <View style={styles.ingredientsSection}>
                      <Text style={styles.recipeDetailsText}>Ingredients:</Text>
                      {selectedRecipeIngredients.map((ingredient, index) => {
                        const ingredientLine = [ingredient.quantity, ingredient.unit, ingredient.ingredient_name]
                          .filter(Boolean)
                          .join(' ');

                        return (
                          <Text key={`${ingredient.ingredient_name}-${index}`} style={styles.recipeDetailsText}>
                            • {ingredientLine}
                          </Text>
                        );
                      })}
                    </View>
                  )}
                  {!!selectedRecipe.description && (
                    <Text style={styles.recipeDetailsText}>
                      Description: {selectedRecipe.description}
                    </Text>
                  )}
                  {selectedRecipe.prep_time_minutes != null && (
                    <Text style={styles.recipeDetailsText}>
                      Prep Time: {selectedRecipe.prep_time_minutes} minutes
                    </Text>
                  )}
                  {selectedRecipe.cook_time_minutes != null && (
                    <Text style={styles.recipeDetailsText}>
                      Cook Time: {selectedRecipe.cook_time_minutes} minutes
                    </Text>
                  )}
                  {selectedRecipe.servings != null && (
                    <Text style={styles.recipeDetailsText}>
                      Servings: {selectedRecipe.servings}
                    </Text>
                  )}
                  {!!selectedRecipe.instructions && (
                    <Text style={styles.recipeDetailsText}>
                      Instructions:{'\n'}{formatRecipeInstructions(selectedRecipe.instructions)}
                    </Text>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f8f9fa' },
  container: { flexGrow: 1, padding: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, marginTop: 40, color: '#333' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10, marginBottom: 15, color: '#333' },
  emailText: { fontSize: 16, color: '#555', marginBottom: 15 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  buttonWrapper: { flex: 1, marginHorizontal: 5 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  switchLabel: { fontSize: 16, color: '#444' },
  
  // Saved Recipe Item Styles
  recipeItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#e0e0e0' },
  recipeTitle: { fontSize: 16, fontWeight: '600', color: '#333', flexShrink: 1 },
  viewText: { fontSize: 14, color: '#007bff', fontWeight: '500' },
  emptyText: { fontStyle: 'italic', color: '#888' },

  // saved recipe style
  recipeItemContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#e0e0e0' },
  recipeTitle: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1, marginRight: 10 },
  recipeActionButtons: { flexDirection: 'row', gap: 8 },
  
  viewButton: { backgroundColor: '#007bff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  viewButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  
  unsaveButton: { backgroundColor: '#dc3545', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  unsaveButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Modal Styles (Copied from RecipesScreen)
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  modalCard: { width: '100%', maxHeight: '80%', backgroundColor: '#c9cbcc', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#6b6e6d', elevation: 6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 },
  recipeImage: { width: '100%', height: 220, borderRadius: 12, marginBottom: 14 },
  ingredientsSection: { marginBottom: 12 },
  modalCloseButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#111' },
  modalCloseButtonText: { color: '#fff', fontWeight: '600' },
  recipeDetailsTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10, flex: 1 },
  recipeDetailsText: { fontSize: 14, lineHeight: 20, marginBottom: 8 }
});