import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';


export default function RecipesScreen() {

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  async function handleLogoutPress(){
    const {error} = await supabase.auth.signOut();

    if (error){
      console.error('Logout failed', error.message);
    }
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
 

      <View style={styles.content}>
        <Text style={styles.title}>👨‍🍳 Recipe Ideas</Text>
        {loading ? (
          <Text>Loading...</Text>
        ) : (
          recipes.map((recipe) => (
            <Text key = {recipe.id}>{recipe.title}</Text>
          ))
        )}
      </View>
    </View>
  );
}
     /*handleLogoutPress - default function from supabase for handling logout, session management handled by supabase*/
     
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
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
});
