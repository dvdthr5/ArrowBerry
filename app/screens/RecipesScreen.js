import { useEffect, useState } from 'react';
import { Alert, Button, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

function RecipeCard({ recipe, onPress }){
  return (
    <Pressable style = {styles.recipeCard} onPress={() => onPress(recipe)}>
      <Text style={styles.recipeCardTitle}>{recipe.title}</Text>
      {!!recipe.description && (
        <Text style={styles.recipeCardDescription}>{recipe.description}</Text>
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
  async function handleLogoutPress(){
    const {error} = await supabase.auth.signOut();

    if (error){
      console.error('Logout failed', error.message);
    }
  }

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
    
    if (authError || !userData?.user) {
      return Alert.alert("Error", "You must be logged in to save recipes.");
    }

    const { error } = await supabase.from('saved_recipes').insert([
      { 
        user_id: userData.user.id, 
        recipe_id: recipe.id,
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
    return instructions.replace(/\s*(\d+\.)\s/g, '\n$1 ').trim();
  }

  useEffect(() => {
      fetchRecipes(); 
    }, []);

  async function fetchRecipes(){
    const { data, error } = await supabase.from('recipes').select('*').limit(20);

    if (!error){
      setRecipes(data || []);
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
          <>
            <View style={styles.recipeList}>
              {recipes.map((recipe) => (
                <RecipeCard
                  key = {recipe.id}
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
});

/* CSS Styles for components on recipe page*/
/* currently main componenets are recipe cards and logout button and the recipeDetails componnent at the bottom */