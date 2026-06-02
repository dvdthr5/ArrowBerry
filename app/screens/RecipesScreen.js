import { useEffect, useState } from 'react';
import { Alert, Button, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getRandomRecipes, getRecipeRecommendations } from '../../lib/recommendations';
import { supabase } from '../../lib/supabase';

function RecipeCard({ recipe, onPress, onReviewPress, averageRating, totalReviews }) {
  const renderStars = (rating) => {
    const stars = Math.round(rating || 0);
    return '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
  };

  return (
    <Pressable style={styles.recipeCard} onPress={() => onPress(recipe)}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={[styles.recipeCardTitle, { flex: 1, marginRight: 8 }]}>{recipe.title}</Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: '#555' }}>
          {renderStars(averageRating)} ({totalReviews || 0})
        </Text>
      </View>

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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <Text style={styles.recipeCardHint}>Tap to view full recipe details</Text>
        <Pressable 
          style={{ backgroundColor: '#007bff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }} 
          onPress={() => onReviewPress(recipe)}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>Reviews</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
export default function RecipesScreen() {
  // --- Reviews State ---
  const [ratingsSummary, setRatingsSummary] = useState({});
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false);
  const [reviewRecipe, setReviewRecipe] = useState(null);
  const [activeRecipeReviews, setActiveRecipeReviews] = useState([]);
  const [userRating, setUserRating] = useState(0);
  const [userReviewText, setUserReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipeIngredients, setSelectedRecipeIngredients] = useState([]);

  const [sessionSavedIds, setSessionSavedIds] = useState({});
  const [selectedCuisine, setSelectedCuisine] = useState(null);
  const CUISINES = ['All', 'Italian', 'Mexican', 'Asian', 'Russian', 'Mediterranean', 'American'];
  const [isPantryEmpty, setIsPantryEmpty] = useState(false);

  async function handleLogoutPress(){
    const {error} = await supabase.auth.signOut();

    if (error){
      console.error('Logout failed', error.message);
    }
  }

  async function handleOpenReviews(recipe) {
    setReviewRecipe(recipe);
    setReviewsModalVisible(true);
    setUserRating(0);
    setUserReviewText('');
    
    const targetRecipeId = recipe.id || recipe.recipe_id;

    const { data, error } = await supabase
      .from('recipe_reviews')
      .select('*')
      .eq('recipe_id', targetRecipeId)
      .order('created_at', { ascending: false });

    if (data) setActiveRecipeReviews(data);
  }

  async function submitReview() {
    try {
      if (userRating === 0) return Alert.alert("Missing Rating", "Please tap a star to select a rating before submitting.");
      setSubmittingReview(true);
      
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        setSubmittingReview(false);
        return Alert.alert("Session Expired", "You must be logged in to leave a review.");
      }

      const targetRecipeId = reviewRecipe?.id || reviewRecipe?.recipe_id;
      const finalReviewText = userReviewText ? userReviewText.trim() : null;

      const { data: existingReview } = await supabase
        .from('recipe_reviews')
        .select('id')
        .eq('user_id', authData.user.id)
        .eq('recipe_id', targetRecipeId)
        .maybeSingle();

      let dbError = null;

      if (existingReview) {
        const { error } = await supabase.from('recipe_reviews')
          .update({ rating: userRating, review_text: finalReviewText })
          .eq('id', existingReview.id);
        dbError = error;
      } else {
        const { error } = await supabase.from('recipe_reviews')
          .insert([{ user_id: authData.user.id, recipe_id: targetRecipeId, rating: userRating, review_text: finalReviewText }]);
        dbError = error;
      }

      if (dbError) {
        Alert.alert("Failed to submit review", dbError.message);
      } else {
        Alert.alert("Review Submitted!", "Your rating has been posted successfully.");
        const { data: freshReviews } = await supabase.from('recipe_reviews')
          .select('*').eq('recipe_id', targetRecipeId).order('created_at', { ascending: false });
        if (freshReviews) setActiveRecipeReviews(freshReviews);
        setUserRating(0); setUserReviewText('');
        fetchRecipes(); 
      }
    } catch (err) {
      Alert.alert("Unexpected Error", "Something went wrong in the app.");
    } finally {
      setSubmittingReview(false);
    }
  }

async function handleRecipePress(recipe){
    setSelectedRecipe(recipe);
    const recipeId = recipe.id ?? recipe.recipe_id;

    if (!recipeId) {
      console.error('Recipe is missing an id:', recipe);
      setSelectedRecipeIngredients([]);
      return;
    }

    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('quantity, unit, ingredient_name')
      .eq('recipe_id', recipeId);

    if (error) {
      console.error('Failed to fetch recipe ingredients', error.message);
      setSelectedRecipeIngredients([]);
      return;
    }

    setSelectedRecipeIngredients(data || []);
  }

  function handleCloseRecipeModal(){
    setSelectedRecipe(null);
    setSelectedRecipeIngredients([]);
  }

  async function handleAddMissingIngredients(recipe) {
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData?.user) {
      return Alert.alert('Error', 'You must be logged in to add items to your shopping list.');
    }

    const missingIngredients = recipe?.missing_list || [];

    if (!missingIngredients.length) {
      return Alert.alert('No Missing Ingredients', 'This recipe does not have any missing ingredients to add.');
    }

    const shoppingListItems = missingIngredients
      .map((ingredient) => ({
        user_id: userData.user.id,
        item_name: ingredient.ingredient_name ?? ingredient.item_name ?? ingredient.name,
        quantity: ingredient.quantity ?? null,
        unit: ingredient.unit ?? null,
      }))
      .filter((ingredient) => ingredient.item_name);

    if (!shoppingListItems.length) {
      return Alert.alert('Error', 'No valid missing ingredients were found for this recipe.');
    }

    const { error } = await supabase
      .from('shopping_list')
      .insert(shoppingListItems);

    if (error) {
      console.error('Failed to add missing ingredients to shopping list:', error.message);
      return Alert.alert('Failed to Add Ingredients', error.message);
    }

    Alert.alert(
      'Shopping List Updated',
      `${shoppingListItems.length} missing ingredient${shoppingListItems.length === 1 ? '' : 's'} added to your shopping list.`
    );
  }

  
  async function handleOpenRecipeSource(recipe) {
    const sourceUrl = recipe?.source;

    if (!sourceUrl) {
      Alert.alert('No Source Found', 'This recipe does not have a source link.');
      return;
    }

    const canOpenUrl = await Linking.canOpenURL(sourceUrl);

    if (!canOpenUrl) {
      Alert.alert('Unable to Open Source', 'This recipe source link is not valid.');
      return;
    }

    await Linking.openURL(sourceUrl);
  }

  async function handleSaveRecipe(recipe) {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !userData?.user) {
      return Alert.alert("Error", "You must be logged in to save recipes.");
    }

    const recipeId = recipe.id ?? recipe.recipe_id;

    if (!recipeId) {
      return Alert.alert("Error", "This recipe is missing an id and cannot be saved.");
    }

    const { error } = await supabase.from('saved_recipes').insert([
      { 
        user_id: userData.user.id, 
        recipe_id: recipeId,
        recipe_title: recipe.title 
      }
    ]);

    if (error) {
      Alert.alert("Failed to save", error.message);
    } else {
      Alert.alert("Success!", `${recipe.title} has been saved to your profile.`);
    }
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

  useEffect(() => {
      fetchRecipes(); 
    }, [selectedCuisine]);
//pushing the new file for debugging 2
//doing this again ignore
async function fetchRecipes() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    // Check if pantry is empty first
    const { count } = await supabase
      .from('pantry_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    if (!count || count === 0) {
      // Empty pantry — fetch random recipes
      setIsPantryEmpty(true);
      const results = await getRandomRecipes(20);
      setRecipes(results);
      // Fetch rating summaries
      const recipeIds = results.map(r => r.id || r.recipe_id);
      if (recipeIds.length > 0) {
        const { data: summaryData } = await supabase
          .from('recipe_rating_summary')
          .select('*')
          .in('recipe_id', recipeIds);

        if (summaryData) {
          const summaryMap = {};
          summaryData.forEach(s => { summaryMap[s.recipe_id] = s; });
          setRatingsSummary(summaryMap);
        }
      }
    } else {
      // Has pantry items — use the recommendation algorithm
      setIsPantryEmpty(false);
      const results = await getRecipeRecommendations(session.user.id, {
        minMatch: 0.0,
        cuisine: selectedCuisine,
      });
      setRecipes(results);
      // Fetch rating summaries
      const recipeIds = results.map(r => r.id || r.recipe_id);
      if (recipeIds.length > 0) {
        const { data: summaryData } = await supabase
          .from('recipe_rating_summary')
          .select('*')
          .in('recipe_id', recipeIds);

        if (summaryData) {
          const summaryMap = {};
          summaryData.forEach(s => { summaryMap[s.recipe_id] = s; });
          setRatingsSummary(summaryMap);
        }
      }
    }
  } catch (err) {
    console.error('Error fetching recipes:', err);
  } finally {
    setLoading(false);
  }
}

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
                  key={recipe.id || recipe.recipe_id}
                  recipe={recipe}
                  onPress={handleRecipePress}
                  onReviewPress={handleOpenReviews}
                  averageRating={ratingsSummary[recipe.id || recipe.recipe_id]?.average_rating || 0}
                  totalReviews={ratingsSummary[recipe.id || recipe.recipe_id]?.total_reviews || 0}
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

                  {/* FIXED: Save Button moved INSIDE the selectedRecipe check */}
                  <View style={{ marginTop: 15 }}>
                    <Button 
                      title={sessionSavedIds[selectedRecipe.id ?? selectedRecipe.recipe_id] ? "✅ Saved to Profile" : "❤️ Save to Profile"} 
                      color={sessionSavedIds[selectedRecipe.id ?? selectedRecipe.recipe_id] ? "gray" : "#28a745"} 
                      disabled={sessionSavedIds[selectedRecipe.id ?? selectedRecipe.recipe_id]}
                      onPress={() => handleSaveRecipe(selectedRecipe)} 
                    />
                    {!!selectedRecipe.missing_list?.length && (
                      <Button
                        title="Add Missing Ingredients to Shopping List"
                        color="#2e7d32"
                        onPress={() => handleAddMissingIngredients(selectedRecipe)}
                      />
                    )}
                    {!!selectedRecipe.source && (
                      <Pressable
                        style={styles.sourceButton}
                        onPress={() => handleOpenRecipeSource(selectedRecipe)}
                      >
                        <Text style={styles.sourceButtonText}>Go to Recipe Source</Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>  
        <Modal visible={reviewsModalVisible} transparent={true} animationType='slide' onRequestClose={() => setReviewsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setReviewsModalVisible(false)} />
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            {reviewRecipe && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.recipeDetailsTitle}>Reviews</Text>
                  <Pressable style={styles.modalCloseButton} onPress={() => setReviewsModalVisible(false)}>
                    <Text style={styles.modalCloseButtonText}>Close</Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>{reviewRecipe.title}</Text>

                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {activeRecipeReviews.length > 0 ? (
                    activeRecipeReviews.map(r => (
                      <View key={r.id} style={{ backgroundColor: '#e9ecef', padding: 12, borderRadius: 12, marginBottom: 10 }}>
                        <Text style={{ fontSize: 16, marginBottom: 4 }}>{'⭐'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
                        {r.review_text ? <Text style={{ fontSize: 14, color: '#333', fontStyle: 'italic' }}>"{r.review_text}"</Text> : null}
                      </View>
                    ))
                  ) : (
                    <Text style={{ fontStyle: 'italic', color: '#666', marginBottom: 20 }}>No reviews yet. Be the first!</Text>
                  )}

                  <View style={{ marginTop: 20, borderTopWidth: 1, borderColor: '#aaa', paddingTop: 20, paddingBottom: 20 }}>
                    <Text style={styles.recipeDetailsTitle}>Leave a Review</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, justifyContent: 'center' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <TouchableOpacity key={star} onPress={() => setUserRating(star)} activeOpacity={0.6}>
                          <Text style={{ fontSize: 36, color: star <= userRating ? '#f5a623' : '#ccc' }}>★</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput 
                      style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', marginBottom: 16, borderWidth: 1, borderColor: '#999' }}
                      placeholder="What did you think of this recipe? (Optional)"
                      multiline
                      value={userReviewText}
                      onChangeText={setUserReviewText}
                    />
                    <Button title={submittingReview ? "Submitting..." : "Submit Review"} onPress={submitReview} disabled={submittingReview} color="#007bff" />
                  </View>
                </ScrollView>
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
  sourceButton: {
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sourceButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
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