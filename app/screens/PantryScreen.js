import { StyleSheet, Text, View } from 'react-native';

export default function PantryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🥦 My Pantry</Text>
      <Text>Your scanned ingredients will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
});