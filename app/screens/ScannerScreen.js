import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Button, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ScannerScreen() {
  const [imageUri, setImageUri] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [loading, setLoading] = useState(false);
  const [csvData, setCsvData] = useState("");
  const [parsedItems, setParsedItems] = useState([]);

  // image uploading
  const pickImage = async () => {
    // permission to access camera roll
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission to access camera roll is required!");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setBase64Image(result.assets[0].base64);
      setCsvData(""); // Reset previous scans
      setParsedItems([]);
    }
  };

  // sending image to gemini and extracting the text in json format
  const analyzeReceipt = async () => {
    if (!base64Image) return Alert.alert("No image", "Select an image first.");
    
    const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    // debugging
    console.log("--- DEBUG START ---");
    console.log("API Key exists:", !!API_KEY); 
    console.log("Model URL:", `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent`);
    
    setLoading(true);
    
    try {
      const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!API_KEY) throw new Error("Missing Gemini API Key in .env file");

      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
      
      // retrieve json format for us to convert to csv and send to db
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Extract the food items and their quantities from this receipt. Return ONLY a valid JSON array of objects with keys 'item_name' and 'quantity'. Do not include markdown formatting." },
              { inline_data: { mime_type: "image/jpeg", data: base64Image } }
            ]
          }]
        })
      });

      const data = await response.json();

      // debug
      console.log("LLM Raw Response:", JSON.stringify(data, null, 2));

      if (data.error) {
        console.error("Gemini API Error:", data.error);
        throw new Error(data.error.message);

      }
      
      // Parse the JSON
      const textOutput = data.candidates[0].content.parts[0].text.trim();
      const items = JSON.parse(textOutput);
      setParsedItems(items);

      // Create CSV format string
      let generatedCsv = "Item,Quantity\n";
      items.forEach(item => {
        generatedCsv += `${item.item_name},${item.quantity}\n`;
      });
      setCsvData(generatedCsv);

    } catch (error) {
      console.error("Analysis Error:", error);
      Alert.alert("Analysis Failed", error.message || "Could not parse the receipt.");
    } finally {
      setLoading(false);
    }
  };

  // sending to supabase db through api endpoints
  const saveToDatabase = async () => {
    setLoading(true);
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      
      if (authError || !userData?.user) {
        throw new Error("You must be logged in to save items to the database.");
      }

      const userId = userData.user.id;

      // prepare data for Supabase insertion
      const insertData = parsedItems.map(item => ({
        user_id: userId,
        item_name: item.item_name,
        quantity: String(item.quantity)
      }));

      // created the "pantry_items" table in supabase manually
      const { error: dbError } = await supabase.from('pantry_items').insert(insertData);
      
      if (dbError) throw dbError;

      Alert.alert("Success!", "Receipt items saved to database.");
      setCsvData("");
      setImageUri(null);

    } catch (error) {
      console.error("Database Error:", error);
      Alert.alert("Save Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>📷 Scan Receipt</Text>
      
      <View style={styles.buttonContainer}>
        <Button title="1. Pick Receipt Image" onPress={pickImage} />
      </View>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.image} />
      )}

      {imageUri && !csvData && (
        <View style={styles.buttonContainer}>
          <Button title="2. Analyze with LLM" onPress={analyzeReceipt} disabled={loading} color="purple" />
        </View>
      )}

      {loading && <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />}

      {/* Display the extracted text for the user to confirm */}
      {csvData ? (
        <View style={styles.resultsContainer}>
          <Text style={styles.subtitle}>Extracted CSV Data:</Text>
          <Text style={styles.csvText}>{csvData}</Text>
          
          <View style={styles.buttonContainer}>
             <Button title="3. Save to Database" onPress={saveToDatabase} color="green" />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, marginTop: 40 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  image: { width: 300, height: 400, resizeMode: 'contain', marginVertical: 15, borderRadius: 10 },
  buttonContainer: { marginVertical: 10, width: '80%' },
  loader: { marginVertical: 20 },
  resultsContainer: { width: '100%', backgroundColor: '#f4f4f4', padding: 15, borderRadius: 10, marginTop: 20 },
  csvText: { fontSize: 14, fontFamily: 'monospace', backgroundColor: '#e0e0e0', padding: 10, borderRadius: 5 }
});