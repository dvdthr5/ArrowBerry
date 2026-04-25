import { useEffect, useState } from 'react';
import { Alert, Button, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

  async function handleLogoutPress(){
    const {error} = await supabase.auth.signOut();

    if (error){
      console.error('Logout failed', error.message);
    }
  }

  function handleRecipePress(recipe){
    setSelectedRecipe(recipe);
  }

  function handleCloseRecipeModal(){
    setSelectedRecipe(null);
  }

  // --- NEW: Function to save the recipe to the database ---
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
    const { data, error } = await supabase.from('recipes').select('*').limit(5);

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
          transparent = {true} 
          animationType='fade'
          onRequestClose={handleCloseRecipeModal}
          >
            <View style = {styles.modalOverlay}>
              <Pressable style = {styles.modalBackdrop} onPress={handleCloseRecipeModal} />
              <View style={styles.modalCard}>
                {selectedRecipe && (
                  <>
                    <View style={styles.modalHeader}>
                      <Text style = {styles.recipeDetailsTitle}>{selectedRecipe.title}</Text>
                      <Pressable style = {styles.modalCloseButton} onPress={handleCloseRecipeModal}>
                        <Text style={styles.modalCloseButtonText}>Close</Text>
                      </Pressable>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                      {!!selectedRecipe.description && (
                        <Text style = {styles.recipeDetailsText}>
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
                      {!!selectedRecipe.source && (
                        <Text style={styles.recipeDetailsText}>
                          Source: {selectedRecipe.source}
                        </Text>
                      )}
                    </ScrollView>
                  </>
                )}

                {/* --- NEW: Save Button --- */}
                <View style={{ marginTop: 15 }}>
                  <Button 
                    title="❤️ Save to Profile" 
                    color="#28a745" 
                    onPress={() => handleSaveRecipe(selectedRecipe)} 
                  />
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
/* TODO: make details component a page popup not a componenet at the bottom of the page. */
/* TODO: once profile page is created, move logout button to profile page*/