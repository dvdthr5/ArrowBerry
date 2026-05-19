import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, Button, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';

function RecipeCard({ recipe, averageRating, totalReviews, onPress, onReviewPress }) {
  const renderStars = (rating) => {
    const stars = Math.round(rating || 0);
    return '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
  };

  return (
    <Pressable style={styles.recipeCard} onPress={() => onPress(recipe)}>
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
        <Pressable style={styles.reviewButton} onPress={() => onReviewPress(recipe)}>
          <Text style={styles.reviewButtonText}>Reviews</Text>
        </Pressable>
      </View>
    </Pressable>
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

  async function handleLogoutPress(){
    const {error} = await supabase.auth.signOut();
    if (error) console.error('Logout failed', error.message);
  }

  // --- REVIEWS LOGIC ---
// --- REVIEWS LOGIC ---
  async function handleOpenReviews(recipe) {
    setReviewRecipe(recipe);
    setReviewsModalVisible(true);
    setUserRating(0);
    setUserReviewText('');
    
    // Fallback just in case the algorithm returned 'recipe_id' instead of 'id'
    const targetRecipeId = recipe.id || recipe.recipe_id;

    // Fetch community reviews for this recipe
    const { data, error } = await supabase
      .from('recipe_reviews')
      .select('*')
      .eq('recipe_id', targetRecipeId)
      .order('created_at', { ascending: false });

    if (data) setActiveRecipeReviews(data);
  }

  async function submitReview() {
    if (userRating === 0) return Alert.alert("Hold on!", "Please select a star rating first.");
    
    setSubmittingReview(true);
    const { data: authData } = await supabase.auth.getUser();
    
    if (authData?.user && reviewRecipe) {
      const targetRecipeId = reviewRecipe.id || reviewRecipe.recipe_id;

      // 1. Check if the user already has a review for this recipe
      const { data: existingReview } = await supabase
        .from('recipe_reviews')
        .select('id')
        .eq('user_id', authData.user.id)
        .eq('recipe_id', targetRecipeId)
        .maybeSingle(); // Safely returns null if no review exists yet

      let dbError = null;

      if (existingReview) {
        // UPDATE existing review
        const { error } = await supabase
          .from('recipe_reviews')
          .update({
            rating: userRating,
            review_text: userReviewText.trim()
          })
          .eq('id', existingReview.id);
        dbError = error;
      } else {
        // INSERT new review
        const { error } = await supabase
          .from('recipe_reviews')
          .insert({
            user_id: authData.user.id,
            recipe_id: targetRecipeId,
            rating: userRating,
            review_text: userReviewText.trim()
          });
        dbError = error;
      }

      if (dbError) {
        console.error("Review Error:", dbError);
        Alert.alert("Failed to submit review", dbError.message);
      } else {
        Alert.alert("Success!", "Your review has been posted.");
        
        // 2. Instantly fetch the fresh list of reviews so it updates on screen!
        const { data: freshReviews } = await supabase
          .from('recipe_reviews')
          .select('*')
          .eq('recipe_id', targetRecipeId)
          .order('created_at', { ascending: false });

        if (freshReviews) setActiveRecipeReviews(freshReviews);

        // 3. Reset the input form fields
        setUserRating(0);
        setUserReviewText('');

        // 4. Update the background recipes list to recalculate the average stars on the cards
        fetchRecipes(); 
      }
    }
    setSubmittingReview(false);
  }
  // -----------------------

  async function submitReview() {
    if (userRating === 0) return Alert.alert("Hold on!", "Please select a star rating first.");
    
    setSubmittingReview(true);
    const { data: userData } = await supabase.auth.getUser();
    
    if (userData?.user && reviewRecipe) {
      const { error } = await supabase
        .from('recipe_reviews')
        .upsert({ 
          user_id: userData.user.id, 
          recipe_id: reviewRecipe.id,
          rating: userRating,
          review_text: userReviewText.trim()
        }, { onConflict: 'user_id, recipe_id' });

      if (error) {
        Alert.alert("Failed to submit review", error.message);
      } else {
        Alert.alert("Success!", "Your review has been posted.");
        // Refresh reviews list
        handleOpenReviews(reviewRecipe); 
        // Refresh average ratings in the background
        fetchRecipes(); 
      }
    }
    setSubmittingReview(false);
  }
  // -----------------------

  async function handleRecipePress(recipe){
    setSelectedRecipe(recipe);
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('quantity, unit, ingredient_name')
      .eq('recipe_id', recipe.id);

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

  async function handleSaveRecipe(recipe) {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) return Alert.alert("Error", "You must be logged in to save recipes.");

    const { error } = await supabase.from('saved_recipes').insert([
      { user_id: userData.user.id, recipe_id: recipe.id, recipe_title: recipe.title }
    ]);

    if (error) {
      Alert.alert("Failed to save", error.message);
    } else {
      setSessionSavedIds(prev => ({ ...prev, [recipe.id]: true }));
      Alert.alert("Success!", `${recipe.title} has been saved to your profile.`);
    }
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

    const { data: recipeData, error } = await supabase.rpc('recommend_recipes', {
      p_user_id: userData.user.id,
      p_limit: 20,
      p_min_match: 0.0 
    });

    if (recipeData) {
      setRecipes(recipeData);

      // Fetch rating summaries for these recipes
      const recipeIds = recipeData.map(r => r.id);
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
    setLoading(false);
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

        {loading ? (
          <Text>Loading...</Text>
        ) : (
          <View style={styles.recipeList}>
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id || recipe.recipe_id}
                recipe={recipe}
                averageRating={ratingsSummary[recipe.id]?.average_rating || 0}
                totalReviews={ratingsSummary[recipe.id]?.total_reviews || 0}
                onPress={handleRecipePress}
                onReviewPress={handleOpenReviews}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* --- RECIPE DETAILS MODAL --- */}
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
                    <Image source={{ uri: selectedRecipe.image_url }} style={styles.recipeImage} resizeMode="cover" />
                  )}
                  {!!selectedRecipeIngredients.length && (
                    <View style={styles.ingredientsSection}>
                      <Text style={styles.recipeDetailsText}>Ingredients:</Text>
                      {selectedRecipeIngredients.map((ingredient, index) => {
                        const ingredientLine = [ingredient.quantity, ingredient.unit, ingredient.ingredient_name].filter(Boolean).join(' ');
                        return (
                          <Text key={`${ingredient.ingredient_name}-${index}`} style={styles.recipeDetailsText}>
                            • {ingredientLine}
                          </Text>
                        );
                      })}
                    </View>
                  )}
                  {!!selectedRecipe.description && <Text style={styles.recipeDetailsText}>Description: {selectedRecipe.description}</Text>}
                  {selectedRecipe.prep_time_minutes != null && <Text style={styles.recipeDetailsText}>Prep Time: {selectedRecipe.prep_time_minutes} min</Text>}
                  {selectedRecipe.cook_time_minutes != null && <Text style={styles.recipeDetailsText}>Cook Time: {selectedRecipe.cook_time_minutes} min</Text>}
                  {!!selectedRecipe.instructions && (
                    <Text style={styles.recipeDetailsText}>
                      Instructions:{'\n'}{formatRecipeInstructions(selectedRecipe.instructions)}
                    </Text>
                  )}
                </ScrollView>

                <View style={{ marginTop: 15 }}>
                  <Button 
                    title={sessionSavedIds[selectedRecipe.id] ? "✅ Saved to Profile" : "❤️ Save to Profile"} 
                    color={sessionSavedIds[selectedRecipe.id] ? "gray" : "#28a745"} 
                    disabled={sessionSavedIds[selectedRecipe.id]}
                    onPress={() => handleSaveRecipe(selectedRecipe)} 
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* --- COMMUNITY REVIEWS MODAL --- */}
      <Modal 
        visible={reviewsModalVisible} 
        transparent={true} 
        animationType='slide'
        onRequestClose={() => setReviewsModalVisible(false)}
      >
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

                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {/* List of Reviews */}
                  {activeRecipeReviews.length > 0 ? (
                    activeRecipeReviews.map(r => (
                      <View key={r.id} style={styles.reviewBubble}>
                        <Text style={styles.starsText}>{'⭐'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
                        {r.review_text ? <Text style={styles.reviewBodyText}>"{r.review_text}"</Text> : null}
                      </View>
                    ))
                  ) : (
                    <Text style={{ fontStyle: 'italic', color: '#666', marginBottom: 20 }}>No reviews yet. Be the first!</Text>
                  )}

                  {/* Write a Review Form */}
                  <View style={styles.writeReviewContainer}>
                    <Text style={styles.recipeDetailsTitle}>Leave a Review</Text>
                    <View style={styles.starSelectionRow}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <Pressable key={star} onPress={() => setUserRating(star)}>
                          <Text style={{ fontSize: 36, color: star <= userRating ? '#f5a623' : '#ccc' }}>★</Text>
                        </Pressable>
                      ))}
                    </View>
                    
                    <TextInput 
                      style={styles.reviewInput}
                      placeholder="What did you think of this recipe?"
                      multiline
                      value={userReviewText}
                      onChangeText={setUserReviewText}
                    />
                    <Button 
                      title={submittingReview ? "Submitting..." : "Submit Review"} 
                      onPress={submitReview} 
                      disabled={submittingReview} 
                      color="#007bff"
                    />
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
  
  // Recipe Card Styles
  recipeCard: { backgroundColor: '#f7f7f7', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  recipeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  recipeCardTitle: { fontSize: 18, fontWeight: '600', flex: 1, marginRight: 8 },
  ratingText: { fontSize: 14, fontWeight: '500', color: '#555' },
  recipeCardDescription: { fontSize: 14, color: '#555', marginBottom: 8 },
  recipeCardHint: { fontSize: 12, color: '#2e7d32', alignSelf: 'center' },
  recipeCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  reviewButton: { backgroundColor: '#007bff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  reviewButtonText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  
  // Badge Styles
  recipeMatchBadge: { fontSize: 13, color: '#2e7d32', fontWeight: '600', marginBottom: 6 },
  recipeMissing: { fontSize: 12, color: '#c0392b', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  
  // Modal Styles
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

  // Reviews Modal Specific Styles
  reviewBubble: { backgroundColor: '#e9ecef', padding: 12, borderRadius: 12, marginBottom: 10 },
  starsText: { fontSize: 16, marginBottom: 4 },
  reviewBodyText: { fontSize: 14, color: '#333', fontStyle: 'italic' },
  writeReviewContainer: { marginTop: 20, borderTopWidth: 1, borderColor: '#aaa', paddingTop: 20, paddingBottom: 20 },
  starSelectionRow: { flexDirection: 'row', gap: 10, marginBottom: 16, justifyContent: 'center' },
  reviewInput: { backgroundColor: '#fff', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', marginBottom: 16, borderWidth: 1, borderColor: '#999' }
});