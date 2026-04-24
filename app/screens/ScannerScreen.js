import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState(false);
  const cameraRef = useRef(null);

  const [imageUri, setImageUri] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [loading, setLoading] = useState(false);
  const [csvData, setCsvData] = useState("");
  const [parsedItems, setParsedItems] = useState([]);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.subtitle}>We need camera access to scan receipts.</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      setLoading(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.7,
        });
        setImageUri(photo.uri);
        setBase64Image(photo.base64);
        setCameraActive(false); 
        setCsvData(""); 
        setParsedItems([]);
      } catch (error) {
        Alert.alert("Camera Error", "Failed to take picture.");
      } finally {
        setLoading(false);
      }
    }
  };


const analyzeReceipt = async () => {
    if (!base64Image) return Alert.alert("No image", "Please take a photo first.");
    setLoading(true);
    
    try {
      const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      
      const cleanBase64 = base64Image.includes(',') 
        ? base64Image.split(',')[1] 
        : base64Image;

      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Extract food items and quantities from this receipt. Return ONLY a valid JSON array of objects with keys 'item_name' and 'quantity'. No markdown formatting." },
              { 
                inlineData: { // camelCase for gemini api
                  mimeType: "image/jpeg", 
                  data: cleanBase64
                } 
              }
            ]
          }]
        })
      });

      const data = await response.json();

      if (data.error) {
        console.log("--- GOOGLE API ERROR DETAILS ---");
        console.log("Message:", data.error.message);
        throw new Error(data.error.message);
      }

      const candidate = data.candidates?.[0];
      if (!candidate || !candidate.content || !candidate.content.parts) {
        throw new Error("Gemini couldn't find any items. Try a clearer photo.");
      }

      const textOutput = candidate.content.parts[0].text;
      const cleanedOutput = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const items = JSON.parse(cleanedOutput);
      setParsedItems(items);

      let generatedCsv = "Item,Quantity\n";
      items.forEach(item => {
        generatedCsv += `${item.item_name},${item.quantity}\n`;
      });
      setCsvData(generatedCsv);

    } catch (error) {
      console.error("Analysis Error:", error);
      Alert.alert("Analysis Failed", error.message || "Check the console for details.");
    } finally {
      setLoading(false);
    }
  };

  const saveToDatabase = async () => {
    setLoading(true);
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData?.user) throw new Error("You must be logged in to save.");

      const insertData = parsedItems.map(item => ({
        user_id: userData.user.id,
        item_name: item.item_name,
        quantity: String(item.quantity)
      }));

      const { error: dbError } = await supabase.from('pantry_items').insert(insertData);
      if (dbError) throw dbError;

      Alert.alert("Success!", "Receipt items saved to database.");
      setCsvData("");
      setImageUri(null);

    } catch (error) {
      Alert.alert("Save Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>📷 Scan Receipt</Text>
      
      {cameraActive ? (
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} facing="back" ref={cameraRef} />
          <View style={styles.cameraControls}>
            <Button title="Cancel" color="red" onPress={() => setCameraActive(false)} />
            <TouchableOpacity style={styles.captureButton} onPress={takePicture} />
            <View style={{ width: 60 }} />{/*  */}
          </View>
        </View>
      ) : (
        <View style={styles.previewContainer}>
          {!imageUri ? (
            <Button title="1. Open Camera" onPress={() => setCameraActive(true)} />
          ) : (
            <View style={{ alignItems: 'center', width: '100%' }}>{/* Wrapper View */}
              <Image source={{ uri: imageUri }} style={styles.image} />
              <View style={styles.buttonRow}>
                <Button title="Retake" onPress={() => setCameraActive(true)} color="gray" />
                {/*  */}
                {!csvData ? (
                  <Button title="2. Analyze with LLM" onPress={analyzeReceipt} disabled={loading} color="purple" />
                ) : null}
              </View>
            </View>
          )}
        </View>
      )}

      {loading ? <ActivityIndicator size="large" color="#0000ff" style={styles.loader} /> : null}

      {csvData ? (
        <View style={styles.resultsContainer}>
          <Text style={styles.subtitle}>Extracted Data:</Text>
          <Text style={styles.csvText}>{csvData}</Text>
          <View style={{ marginTop: 15 }}>
            <Button title="3. Save to Database" onPress={saveToDatabase} color="green" />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, marginTop: 40 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  
  cameraContainer: { width: '100%', height: 500, borderRadius: 10, overflow: 'hidden', marginTop: 10 },
  camera: { flex: 1 },
  cameraControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#000', padding: 20 },
  captureButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', borderWidth: 4, borderColor: '#ccc' },
  
  previewContainer: { width: '100%', alignItems: 'center', marginTop: 10 },
  image: { width: 300, height: 400, resizeMode: 'contain', marginVertical: 15, borderRadius: 10 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  
  loader: { marginVertical: 20 },
  resultsContainer: { width: '100%', backgroundColor: '#f4f4f4', padding: 15, borderRadius: 10, marginTop: 20 },
  csvText: { fontSize: 14, fontFamily: 'monospace', backgroundColor: '#e0e0e0', padding: 10, borderRadius: 5 }
});