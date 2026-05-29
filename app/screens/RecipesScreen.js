import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

// Shared Helper Function for rendering colored stars across the app
function renderStars(rating) {
  const stars = Math.round(rating || 0);
  return (
    <Text>
      <Text style={{ color: '#FFB800' }}>{'★'.repeat(stars)}</Text>
      <Text style={{ color: '#a0a0a0' }}>{'★'.repeat(5 - stars)}</Text>
    </Text>
  );
}

function RecipeCard({ recipe, averageRating, totalReviews, onPress, onReviewPress }) {
  return (
    <TouchableOpacity style={styles.recipeCard} onPress={() => onPress(recipe)} activeOpacity={0.7}>
      <View style={styles.recipeCardHeader}>
        <Text style={styles.recipeCardTitle}>{recipe.title}</Text>
        <Text style={styles.ratingText}>
          {renderStars(averageRating)} ({totalReviews || 0})
        </Text>
      </View>
      
      <Text style={styles.recipeMatchBadge}>
        {Math.round(recipe.match_percentage * 100)}% match
        {' • '}
        {recipe.matched_ingredients}/{recipe.total_ingredients} ingredients
      </Text>
      
      {!!recipe.description && (
        <Text style={styles.recipeCardDescription}>{recipe.description}</Text>
      )}
      
      {recipe.missing_list && recipe.missing_list.length > 0 && (
        <Text style={styles.recipeMissing}>
          Missing: {recipe.missing_list.map(m => m.ingredient_name).join(', ')}
        </Text>
      )}
      
      <View style={styles.recipeCardFooter}>
        <Text style={styles.recipeCardHint}>Tap for details</Text>
        <TouchableOpacity style={styles.reviewButton} onPress={() => onReviewPress(recipe)}>
          <Text style={styles.reviewButtonText}>Reviews</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function RecipesScreen() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionSavedIds, setSessionSavedIds] = useState({});
  const [ratingsSummary, setRatingsSummary] = useState({});

  // Recipe Details Modal State
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedRecipeIngredients, setSelectedRecipeIngredients] = useState([]);

  // Reviews Modal State
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false);
  const [reviewRecipe, setReviewRecipe] = useState(null);
  const [activeRecipeReviews, setActiveRecipeReviews] = useState([]);
  const [userRating, setUserRating] = useState(0);
  const [userReviewText, setUserReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewErrorMsg, setReviewErrorMsg] = useState('');

  // Extract variables for the active review modal to display current averages
  const activeReviewRecipeId = reviewRecipe ? (reviewRecipe.id || reviewRecipe.recipe_id) : null;
  const activeReviewAvgRating = activeReviewRecipeId ? (ratingsSummary[activeReviewRecipeId]?.average_rating || 0) : 0;
  const activeReviewTotal = activeReviewRecipeId ? (ratingsSummary[activeReviewRecipeId]?.total_reviews || 0) : 0;

  // Filter reviews to ONLY show those with actual text written
  const textReviews = activeRecipeReviews.filter(r => r.review_text && r.review_text.trim() !== '');

  async function handleLogoutPress(){
    const {error} = await supabase.auth.signOut();
    if (error) console.error('Logout failed', error.message);
  }

  async function handleOpenReviews(recipe) {
    setReviewRecipe(recipe);
    setReviewsModalVisible(true);
    setUserRating(0);
    setUserReviewText('');
    setReviewErrorMsg('');
    
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
      if (userRating === 0) {
        setReviewErrorMsg("⚠️ Please tap a star to select a rating.");
        return;
      }
      
      setReviewErrorMsg('');
      setSubmittingReview(true);
      
      const { data: authData, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authData?.user) {
        setReviewErrorMsg("Session Expired. Please log in again.");
        setSubmittingReview(false);
        return;
      }

      if (!reviewRecipe) {
        setReviewErrorMsg("Could not identify the recipe to review.");
        setSubmittingReview(false);
        return;
      }

      const targetRecipeId = reviewRecipe.id || reviewRecipe.recipe_id;
      const finalReviewText = userReviewText ? userReviewText.trim() : null;

      const { data: existingReview } = await supabase
        .from('recipe_reviews')
        .select('id')
        .eq('user_id', authData.user.id)
        .eq('recipe_id', targetRecipeId)
        .maybeSingle();

      let dbError = null;

      if (existingReview) {
        const { error } = await supabase
          .from('recipe_reviews')
          .update({ rating: userRating, review_text: finalReviewText })
          .eq('id', existingReview.id);
        dbError = error;
      } else {
        const { error } = await supabase
          .from('recipe_reviews')
          .insert([{
            user_id: authData.user.id,
            recipe_id: targetRecipeId,
            rating: userRating,
            review_text: finalReviewText
          }]);
        dbError = error;
      }

      if (dbError) {
        console.error("Database Error:", dbError);
        setReviewErrorMsg(`Failed to save: ${dbError.message}`);
      } else {
        Alert.alert("Review Submitted!", "Your rating has been posted successfully.");
        
        const { data: freshReviews } = await supabase
          .from('recipe_reviews')
          .select('*')
          .eq('recipe_id', targetRecipeId)
          .order('created_at', { ascending: false });

        if (freshReviews) setActiveRecipeReviews(freshReviews);

        setUserRating(0);
        setUserReviewText('');
        fetchRecipes(); // This automatically updates the stars/count on the recipe tile AND the active modal header!
      }
    } catch (err) {
      console.error("Unexpected Code Error:", err);
      setReviewErrorMsg("An unexpected error occurred.");
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleRecipePress(recipe){
    setSelectedRecipe(recipe);
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('quantity, unit, ingredient_name')
      .eq('recipe_id', recipe.id || recipe.recipe_id);

    if (data) setSelectedRecipeIngredients(data);
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
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return Alert.alert("Error", "You must be logged in.");

    const { error } = await supabase.from('saved_recipes').insert([
      { user_id: userData.user.id, recipe_id: recipe.id || recipe.recipe_id, recipe_title: recipe.title }
    ]);

    if (!error) {
      setSessionSavedIds(prev => ({ ...prev, [recipe.id || recipe.recipe_id]: true }));
      Alert.alert("Success!", `${recipe.title} has been saved.`);
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
    if (!instructions) return '';
    const instructionText = Array.isArray(instructions) ? instructions.join('\n') : String(instructions);
    const formattedInstructions = instructionText.replace(/\s*(\d+\.)\s/g, '\n$1 ').trim();
    const lines = formattedInstructions.split('\n').map((line) => line.trim()).filter(Boolean);
    const uniqueLines = [];
    const seenInstructionText = new Set();

    lines.forEach((line) => {
      const instructionBody = line.replace(/^\d+\.\s*/, '').trim()
      const normalizedLine = instructionBody.toLowerCase()
      if (seenInstructionText.has(normalizedLine)) return;
      seenInstructionText.add(normalizedLine);
      uniqueLines.push(`${uniqueLines.length + 1}. ${instructionBody}`);
    });
    return uniqueLines.join('\n');
  }

  useFocusEffect(
    useCallback(() => {
      fetchRecipes();
    }, [])
  );

  async function fetchRecipes() {
    setLoading(true);
    const { data: userData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !userData?.user) {
      setLoading(false);
      return;
    }

    const { data: recipeData } = await supabase.rpc('recommend_recipes', {
      p_user_id: userData.user.id,
      p_limit: 20,
      p_min_match: 0.0 
    });

    if (recipeData) {
      setRecipes(recipeData);

      const recipeIds = recipeData.map(r => r.id || r.recipe_id).filter(Boolean);

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
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View />
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutPress}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>👨‍🍳 Recipe Ideas</Text>

        {loading ? (
          <Text>Loading...</Text>
        ) : (
          <View style={styles.recipeList}>
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id || recipe.recipe_id}
                recipe={recipe}
                averageRating={ratingsSummary[recipe.id || recipe.recipe_id]?.average_rating || 0}
                totalReviews={ratingsSummary[recipe.id || recipe.recipe_id]?.total_reviews || 0}
                onPress={handleRecipePress}
                onReviewPress={handleOpenReviews}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* --- RECIPE DETAILS MODAL --- */}
      <Modal visible={!!selectedRecipe} transparent={true} animationType='fade' onRequestClose={handleCloseRecipeModal}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={handleCloseRecipeModal} activeOpacity={1} />
          <View style={styles.modalCard}>
            {selectedRecipe && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.recipeDetailsTitle}>{selectedRecipe.title}</Text>
                  <TouchableOpacity style={styles.modalCloseButton} onPress={handleCloseRecipeModal}>
                    <Text style={styles.modalCloseButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {!!selectedRecipe.image_url && (
                    <Image source={{ uri: selectedRecipe.image_url }} style={styles.recipeImage} resizeMode="cover" />
                  )}
                  {!!selectedRecipeIngredients.length && (
                    <View style={styles.ingredientsSection}>
                      <Text style={styles.recipeDetailsText}>Ingredients:</Text>
                      {selectedRecipeIngredients.map((ingredient, index) => {
                        const ingredientLine = [ingredient.quantity, ingredient.unit, ingredient.ingredient_name].filter(Boolean).join(' ');
                        return <Text key={index} style={styles.recipeDetailsText}>• {ingredientLine}</Text>;
                      })}
                    </View>
                  )}
                  {!!selectedRecipe.description && <Text style={styles.recipeDetailsText}>Description: {selectedRecipe.description}</Text>}
                  {!!selectedRecipe.instructions && (
                    <Text style={styles.recipeDetailsText}>Instructions:{'\n'}{formatRecipeInstructions(selectedRecipe.instructions)}</Text>
                  )}
                </ScrollView>

                <View style={{ marginTop: 15 }}>
                  <TouchableOpacity 
                    style={[styles.saveProfileBtn, sessionSavedIds[selectedRecipe.id || selectedRecipe.recipe_id] && styles.saveProfileBtnDisabled]}
                    disabled={sessionSavedIds[selectedRecipe.id || selectedRecipe.recipe_id]}
                    onPress={() => handleSaveRecipe(selectedRecipe)}
                  >
                    <Text style={styles.saveProfileBtnText}>
                      {sessionSavedIds[selectedRecipe.id || selectedRecipe.recipe_id] ? "✅ Saved to Profile" : "❤️ Save to Profile"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* --- COMMUNITY REVIEWS MODAL --- */}
      <Modal visible={reviewsModalVisible} transparent={true} animationType='slide' onRequestClose={() => setReviewsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setReviewsModalVisible(false)} activeOpacity={1} />
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            {reviewRecipe && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.recipeDetailsTitle}>Community Reviews</Text>
                  <TouchableOpacity style={styles.modalCloseButton} onPress={() => setReviewsModalVisible(false)}>
                    <Text style={styles.modalCloseButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
                
                {/* UPGRADED: Recipe Title with live aggregated star ratings side-by-side */}
                <View style={styles.activeRecipeHeaderContainer}>
                  <Text style={styles.activeRecipeTitle}>{reviewRecipe.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ fontSize: 16 }}>{renderStars(activeReviewAvgRating)}</Text>
                    <Text style={{ fontSize: 14, color: '#555', marginLeft: 6, fontWeight: '600' }}>
                       ({activeReviewTotal} {activeReviewTotal === 1 ? 'review' : 'reviews'})
                    </Text>
                  </View>
                </View>

                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                  {/* List of Previous Reviews (Filtered to only show text reviews) */}
                  {textReviews.length > 0 ? (
                    textReviews.map(r => (
                      <View key={r.id} style={styles.reviewBubble}>
                        <Text style={styles.starsText}>
                          <Text style={{ color: '#FFB800' }}>{'★'.repeat(r.rating || 0)}</Text>
                          <Text style={{ color: '#a0a0a0' }}>{'★'.repeat(5 - (r.rating || 0))}</Text>
                        </Text>
                        <Text style={styles.reviewBodyText}>"{r.review_text}"</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ fontStyle: 'italic', color: '#666', marginBottom: 20 }}>No written reviews yet. Be the first!</Text>
                  )}

                  {/* Interactive Review Entry */}
                  <View style={styles.writeReviewContainer}>
                    <Text style={styles.recipeDetailsTitle}>Leave a Review</Text>
                    
                    {reviewErrorMsg ? <Text style={styles.errorText}>{reviewErrorMsg}</Text> : null}

                    <View style={styles.starSelectionRow}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <TouchableOpacity 
                          key={star} 
                          onPress={() => setUserRating(star)}
                          style={styles.starTouchable}
                          activeOpacity={0.5}
                        >
                          <Text style={[
                            styles.interactiveStar, 
                            star <= userRating ? styles.starSelected : styles.starUnselected
                          ]}>
                            ★
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    <TextInput 
                      style={styles.reviewInput}
                      placeholder="What did you think of this recipe? (Optional)"
                      multiline
                      value={userReviewText}
                      onChangeText={setUserReviewText}
                    />
                    
                    <TouchableOpacity 
                      style={[styles.submitActionBtn, submittingReview && styles.submitActionBtnDisabled]} 
                      onPress={submitReview} 
                      disabled={submittingReview}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.submitActionBtnText}>
                        {submittingReview ? "Submitting..." : "Submit Review"}
                      </Text>
                    </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16, paddingHorizontal: 16 },
  headerRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  logoutButton: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#111' },
  logoutButtonText: { color: '#fff', fontWeight: '600' },
  scrollContent: { paddingBottom: 24 },
  recipeList: { gap: 12, marginTop: 12 },
  recipeCard: { backgroundColor: '#f7f7f7', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  recipeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  recipeCardTitle: { fontSize: 18, fontWeight: '600', flex: 1, marginRight: 8 },
  ratingText: { fontSize: 14, fontWeight: '500', color: '#555' },
  recipeCardDescription: { fontSize: 14, color: '#555', marginBottom: 8 },
  recipeCardHint: { fontSize: 12, color: '#2e7d32', alignSelf: 'center' },
  recipeCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  reviewButton: { backgroundColor: '#007bff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  reviewButtonText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  recipeMatchBadge: { fontSize: 13, color: '#2e7d32', fontWeight: '600', marginBottom: 6 },
  recipeMissing: { fontSize: 12, color: '#c0392b', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  modalCard: { width: '100%', maxHeight: '80%', backgroundColor: '#c9cbcc', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#6b6e6d', elevation: 6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 },
  modalCloseButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#111' },
  modalCloseButtonText: { color: '#fff', fontWeight: '600' },
  recipeImage: { width: '100%', height: 220, borderRadius: 12, marginBottom: 14 },
  ingredientsSection: { marginBottom: 12 },
  recipeDetailsTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  recipeDetailsText: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  saveProfileBtn: { backgroundColor: '#28a745', padding: 12, borderRadius: 8, alignItems: 'center' },
  saveProfileBtnDisabled: { backgroundColor: 'gray' },
  saveProfileBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  // Reviews Styles
  activeRecipeHeaderContainer: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#999' },
  activeRecipeTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  reviewBubble: { backgroundColor: '#e9ecef', padding: 12, borderRadius: 12, marginBottom: 10 },
  starsText: { fontSize: 16, marginBottom: 4 },
  reviewBodyText: { fontSize: 14, color: '#333', fontStyle: 'italic' },
  writeReviewContainer: { marginTop: 20, borderTopWidth: 1, borderColor: '#aaa', paddingTop: 20, paddingBottom: 20 },
  starSelectionRow: { flexDirection: 'row', marginBottom: 20, justifyContent: 'center', alignItems: 'center' },  
  starTouchable: { paddingHorizontal: 6, paddingVertical: 10, marginHorizontal: 2 },
  interactiveStar: { fontSize: 45, textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  starSelected: { color: '#FFB800' },
  starUnselected: { color: '#777777' }, 
  reviewInput: { backgroundColor: '#fff', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', marginBottom: 16, borderWidth: 1, borderColor: '#999' },
  submitActionBtn: { backgroundColor: '#007bff', padding: 14, borderRadius: 8, alignItems: 'center' },
  submitActionBtnDisabled: { backgroundColor: '#80bdff' },
  submitActionBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  errorText: { color: 'red', fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }
});