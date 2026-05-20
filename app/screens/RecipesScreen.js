import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getRandomRecipes, getRecipeRecommendations } from '../../lib/recommendations';
import { supabase } from '../../lib/supabase';

function RecipeCard({ recipe, onPress }) {
  return (
    <Pressable style={styles.recipeCard} onPress={() => onPress(recipe)}>
      <Text style={styles.recipeCardTitle}>{recipe.title}</Text>
      {recipe.total_ingredients > 0 && (
        <Text style={styles.recipeMatchBadge}>
          {Math.round(recipe.match_percentage * 100)}% match
          {' • '}
          {recipe.matched_ingredients}/{recipe.total_ingredients} ingredients
        </Text>
      )}
      {!!recipe.description && (
        <Text style={styles.recipeCardDescription}>{recipe.description}</Text>
      )}
      {recipe.missing_list && recipe.missing_list.length > 0 && (
        <Text style={styles.recipeMissing}>
          Missing: {recipe.missing_list.map(m => m.ingredient_name).join(', ')}
        </Text>
      )}
      <Text style={styles.recipeCardHint}>Tap to view full recipe details</Text>
    </Pressable>
  );
}

export default function RecipesScreen() {
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipeIngredients, setSelectedRecipeIngredients] = useState([]);

  const [sessionSavedIds, setSessionSavedIds] = useState({});
  const [selectedCuisine, setSelectedCuisine] = useState(null);
  const CUISINES = ['All', 'Italian', 'Mexican', 'Asian', 'Russian', 'Mediterranean', 'American'];
  const [isPantryEmpty, setIsPantryEmpty] = useState(false);

  function getRecipeId(recipe) {
    return recipe?.recipe_id || recipe?.id;
  }

  function normalizeShoppingItemName(value) {
    if (!value) return '';
    return value.trim().toLowerCase().replace(/\s+/g, '');
  }

  function getMissingIngredientQuantity(ingredientName) {
    const matchingIngredient = selectedRecipeIngredients.find((ingredient) => (
      normalizeShoppingItemName(ingredient.ingredient_name) === normalizeShoppingItemName(ingredientName)
    ));

    if (!matchingIngredient?.quantity) {
      return null;
    }

    const numericQuantity = Number(matchingIngredient.quantity);
    return Number.isNaN(numericQuantity) ? null : numericQuantity;
  }

  function getMissingIngredientUnit(ingredientName) {
  const matchingIngredient = selectedRecipeIngredients.find((ingredient) => (
    normalizeShoppingItemName(ingredient.ingredient_name) === normalizeShoppingItemName(ingredientName)
  ));

  return matchingIngredient?.unit || null;
}

  // Helper: Normalize a recipe ingredient object to a standard shape
  function normalizeRecipeIngredient(ingredient) {
    if (!ingredient) {
      return null;
    }

    if (typeof ingredient === 'string') {
      return {
        ingredient_name: ingredient,
        quantity: null,
        unit: '',
      };
    }

    const ingredientName = ingredient.ingredient_name
      || ingredient.ingredientName
      || ingredient.name
      || ingredient.item_name
      || ingredient.title;

    if (!ingredientName) {
      return null;
    }

    return {
      ingredient_name: ingredientName,
      quantity: ingredient.quantity ?? ingredient.amount ?? null,
      unit: ingredient.measurement_unit
        ?? ingredient.measurementUnit
        ?? ingredient.measuringUnit
        ?? ingredient.unit
        ?? ingredient.unit_name
        ?? '',
    };
  }

  // Helper: Get a fallback list of normalized ingredients from a recipe object
  function getRecipeIngredientFallback(recipe) {
    const possibleIngredientLists = [
      recipe?.ingredients,
      recipe?.ingredient_list,
      recipe?.ingredients_list,
      recipe?.matched_list,
      recipe?.missing_list,
    ];

    return possibleIngredientLists
      .filter(Array.isArray)
      .flat()
      .map(normalizeRecipeIngredient)
      .filter(Boolean);
  }

  // Helper: Format the quantity, removing trailing .0 for integers
  function formatIngredientQuantity(quantity) {
    if (quantity == null || quantity === '') {
      return '';
    }

    const numericQuantity = Number(quantity);

    if (Number.isNaN(numericQuantity)) {
      return String(quantity);
    }

    return Number.isInteger(numericQuantity)
      ? String(numericQuantity)
      : String(numericQuantity).replace(/\.0+$/, '');
  }

  // Helper: Format ingredient amount for display (quantity + unit)
  function formatIngredientAmount(ingredient) {
    return [
      formatIngredientQuantity(ingredient.quantity),
      ingredient.unit,
    ]
      .filter((value) => value != null && String(value).trim() !== '')
      .join(' ');
  }

  // Helper: Format ingredient name for display
  function formatIngredientName(ingredient) {
    return ingredient.ingredient_name || '';
  }

  async function handleLogoutPress(){
    const {error} = await supabase.auth.signOut();

    if (error){
      console.error('Logout failed', error.message);
    }
  }

async function handleRecipePress(recipe){
  const fallbackIngredients = getRecipeIngredientFallback(recipe);

  setSelectedRecipe(recipe);
  setSelectedRecipeIngredients(fallbackIngredients);

  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('ingredient_name, quantity, unit')
    .eq('recipe_id', getRecipeId(recipe));

  if (error) {
    console.error('Failed to fetch recipe ingredients', error.message);
    return;
  }

  const normalizedIngredients = (data || [])
    .map(normalizeRecipeIngredient)
    .filter(Boolean);

  console.log('Recipe ingredients fetched:', normalizedIngredients);

  setSelectedRecipeIngredients(normalizedIngredients.length ? normalizedIngredients : fallbackIngredients);
}

  function handleCloseRecipeModal(){
    setSelectedRecipe(null);
    setSelectedRecipeIngredients([]);
  }

  async function handleSaveRecipe(recipe) {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !userData?.user) {
      return Alert.alert("Error", "You must be logged in to save recipes.");
    }

    const { error } = await supabase.from('saved_recipes').insert([
      {
        user_id: userData.user.id,
        recipe_id: getRecipeId(recipe),
        recipe_title: recipe.title,
      }
    ]);

    if (error) {
      Alert.alert("Failed to save", error.message);
    } else {
      setSessionSavedIds((previousSavedIds) => ({
        ...previousSavedIds,
        [getRecipeId(recipe)]: true,
      }));
      Alert.alert("Success!", `${recipe.title} has been saved to your profile.`);
    }
  }

  async function handleAddMissingIngredients(recipe) {
    if (!recipe?.missing_list || recipe.missing_list.length === 0) {
      return Alert.alert('No Missing Ingredients', 'This recipe does not have any missing ingredients to add.');
    }

    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData?.user) {
      return Alert.alert('Error', 'You must be logged in to add shopping list items.');
    }

    const shoppingItems = recipe.missing_list
      .map((ingredient) => ({
        user_id: userData.user.id,
        item_name: ingredient.ingredient_name,
        quantity: getMissingIngredientQuantity(ingredient.ingredient_name),
        unit: getMissingIngredientUnit(ingredient.ingredient_name),
        checked: false,
      }))
      .filter((ingredient) => ingredient.item_name);

    if (shoppingItems.length === 0) {
      return Alert.alert('No Missing Ingredients', 'There are no valid missing ingredients to add.');
    }

    const { data: existingItems, error: fetchError } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', userData.user.id);

    if (fetchError) {
      return Alert.alert('Failed to Add Ingredients', fetchError.message);
    }

    const inserts = [];
    const updates = [];

    shoppingItems.forEach((shoppingItem) => {
      const matchingItem = (existingItems || []).find((existingItem) => (
        normalizeShoppingItemName(existingItem.item_name) === normalizeShoppingItemName(shoppingItem.item_name)
      ));

      if (matchingItem) {
        updates.push({
          id: matchingItem.id,
          quantity: (Number(matchingItem.quantity) || 0) + (Number(shoppingItem.quantity) || 0),
        });
      } else {
        inserts.push(shoppingItem);
      }
    });

    const updateResults = await Promise.all(updates.map((item) => (
      supabase
        .from('shopping_list')
        .update({ quantity: item.quantity || null })
        .eq('id', item.id)
    )));

    const updateError = updateResults.find((result) => result.error)?.error;

    if (updateError) {
      return Alert.alert('Failed to Add Ingredients', updateError.message);
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from('shopping_list').insert(inserts);

      if (error) {
        return Alert.alert('Failed to Add Ingredients', error.message);
      }
    }

    Alert.alert('Added to Shopping List', 'Missing ingredients were added to your shopping list.');
  }

  function formatRecipeInstructions(instructions){
    if (!instructions){
      return '';
    }

    const instructionText = Array.isArray(instructions)
      ? instructions.join('\n')
      : String(instructions);

    const formattedInstructions = instructionText
      .replace(/\s*(\d+\.)\s/g, '\n$1 ')
      .trim();

    const lines = formattedInstructions
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const uniqueLines = [];
    const seenInstructionText = new Set();

    lines.forEach((line) => {
      const instructionBody = line
        .replace(/^\d+\.\s*/, '')
        .trim()

      const normalizedLine = instructionBody.toLowerCase()
      if (seenInstructionText.has(normalizedLine)) {
        return;
      }

      seenInstructionText.add(normalizedLine);
      uniqueLines.push(`${uniqueLines.length + 1}. ${instructionBody}`);
    });

    return uniqueLines.join('\n');
  }

  const fetchRecipes = useCallback(async () => {
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setRecipes([]);
        return;
      }

      // Check if pantry is empty first
      const { count, error: pantryError } = await supabase
        .from('pantry_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id);

      if (pantryError) {
        console.error('Failed to check pantry items:', pantryError.message);
        setRecipes([]);
        return;
      }

      if (!count || count === 0) {
        // Empty pantry - fetch random recipes
        setIsPantryEmpty(true);
        const results = await getRandomRecipes(20);
        setRecipes(results || []);
      } else {
        // Has pantry items - use the recommendation algorithm
        setIsPantryEmpty(false);
        const results = await getRecipeRecommendations(session.user.id, {
          minMatch: 0.0,
          cuisine: selectedCuisine,
        });
        setRecipes(results || []);
      }
    } catch (err) {
      console.error('Error fetching recipes:', err);
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCuisine]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  useFocusEffect(
    useCallback(() => {
      fetchRecipes();
    }, [fetchRecipes])
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View />
        <Pressable style={styles.logoutButton} onPress={handleLogoutPress}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </Pressable>
      </View>
 

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>👨‍🍳 Recipe Ideas</Text>
        {isPantryEmpty && (
          <View style={styles.emptyPantryBanner}>
            <Text style={styles.emptyPantryBannerText}>
              📦 Your pantry is empty. Showing random recipes. Add items to your pantry for personalized recommendations!
            </Text>
          </View>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cuisineRow}
        >
          {CUISINES.map((c) => {
            const isActive = (c === 'All' && !selectedCuisine) || selectedCuisine === c;
            return (
              <Pressable
                key={c}
                style={[styles.cuisineChip, isActive && styles.cuisineChipActive]}
                onPress={() => setSelectedCuisine(c === 'All' ? null : c)}
              >
                <Text style={[styles.cuisineChipText, isActive && styles.cuisineChipTextActive]}>
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <Text>Loading...</Text>
          ) : recipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {selectedCuisine 
                  ? `No ${selectedCuisine} recipes match your pantry yet.`
                  : 'No recipes match your pantry yet.'}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Try a different cuisine or add more items to your pantry.
              </Text>
            </View>
        ) : (
          <>
            <View style={styles.recipeList}>
              {recipes.map((recipe) => (
                <RecipeCard
                  key = {getRecipeId(recipe)}
                  recipe = {recipe}
                  onPress = {handleRecipePress}
                />
              ))}
            </View>
            </>
        )}
        </ScrollView>
        <Modal 
          visible={!!selectedRecipe} 
          transparent={true} 
          animationType='fade'
          onRequestClose={handleCloseRecipeModal}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={handleCloseRecipeModal} />
            <View style={styles.modalCard}>
              {/* SAFETY CHECK: Everything inside here only runs if selectedRecipe exists */}
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
                          const ingredientAmount = formatIngredientAmount(ingredient);
                          const ingredientName = formatIngredientName(ingredient);

                          return (
                            <View key={`${ingredientName}-${index}`} style={styles.ingredientRow}>
                              <Text style={styles.ingredientBullet}>•</Text>
                              <Text style={styles.ingredientAmount}>
                                {ingredientAmount || '—'}
                              </Text>
                              <Text style={styles.ingredientName}>
                                {ingredientName}
                              </Text>
                            </View>
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

                  {/* FIXED: Save Button moved INSIDE the selectedRecipe check */}
                  <View style={{ marginTop: 15, gap: 10 }}>
                    <Button 
                      title={sessionSavedIds[getRecipeId(selectedRecipe)] ? "Saved to Profile" : "Save to Profile"} 
                      color={sessionSavedIds[getRecipeId(selectedRecipe)] ? "gray" : "#28a745"} 
                      disabled={sessionSavedIds[getRecipeId(selectedRecipe)]}
                      onPress={() => handleSaveRecipe(selectedRecipe)} 
                    />
                    {!!selectedRecipe.missing_list?.length && (
                      <Button
                        title="Add Missing Ingredients to Shopping List"
                        color="#2e7d32"
                        onPress={() => handleAddMissingIngredients(selectedRecipe)}
                      />
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
          
    </View>
  );
}
     /*handleLogoutPress - default function from supabase for handling logout, session management handled by supabase*/
     /* fetch recipes - currently just grabs the first 5 recipes from the database and displays them in the Recipe card view*/
     /* TODO: once alg is completed we need to change fetchRecipes function to fetchMakeableRecipes*/

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoutButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#111',
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  recipeList: {
    gap: 12,
    marginTop: 12,
  },
  recipeCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  recipeCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  recipeCardDescription: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  recipeCardHint: {
    fontSize: 12,
    color: '#2e7d32',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalCard:{
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#c9cbcc',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#6b6e6d',
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  recipeImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 14,
  },
  ingredientsSection: {
    marginBottom: 12,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ingredientBullet: {
    fontSize: 14,
    lineHeight: 20,
    marginRight: 6,
    color: '#111',
  },
  ingredientAmount: {
    width: 70,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#111',
  },
  ingredientName: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#111',
  },
  modalCloseButton: {
    paddingVertical: 8, 
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#111',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  recipeDetailsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  recipeDetailsText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  recipeMatchBadge: {
    fontSize: 13,
    color: '#2e7d32',
    fontWeight: '600',
    marginBottom: 6,
  },
  recipeMissing: {
    fontSize: 12,
    color: '#c0392b',
    marginBottom: 6,
    },
    cuisineRow: {
    gap: 8,
    paddingVertical: 8,
    marginBottom: 4,
  },
  cuisineChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cuisineChipActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  cuisineChipText: {
    fontSize: 14,
    color: '#444',
  },
  cuisineChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
  padding: 24,
  alignItems: 'center',
  marginTop: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  emptyPantryBanner: {
  backgroundColor: '#fff3cd',
  borderColor: '#ffc107',
  borderWidth: 1,
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
  },
  emptyPantryBannerText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
});

/* CSS Styles for components on recipe page*/
/* currently main componenets are recipe cards and logout button and the recipeDetails componnent at the bottom */