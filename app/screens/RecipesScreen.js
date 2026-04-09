import { Button, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';


export default function RecipesScreen() {

  async function handleLogoutPress(){
    const {error} = await supabase.auth.signOut();

    if (error){
      console.error('Logout failed', error.message);
    }
  }


  return (
    <View style={styles.container}>
      <Text style={styles.title}>👨‍🍳 Recipe Ideas</Text>
      <Text>AI recommendations will appear here.</Text>
      <View style = {styles.topRightButton}>
        <Button title ="Logout" onPress = {handleLogoutPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
});