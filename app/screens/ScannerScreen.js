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
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync(); // camera roll permission req
    if (permissionResult.granted === false) {
      Alert.alert("Permission to access camera roll is required!");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({ // store image that use selects
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) { // if storing image was unsuccessful
      setImageUri(result.assets[0].uri);
      setBase64Image(result.assets[0].base64);
      setCsvData(""); // Reset previous scans
      setParsedItems([]);
    }
  };

  // sending image to gemini and extracting the text in json format
  const analyzeReceipt = async () => {
    if (!base64Image) return Alert.alert("No image", "Select an image first."); // precautionary, error should already be caught at this point
    
    const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
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
                            {
                text: `Carefully analyze this receipt image and extract all visible receipt data.

                        Important rules:
                        1. Extract every item shown on the receipt.
                        2. Detect quantities from indicators such as "2 x", "QTY 2", weights, or numbers before item names.
                        3. For each item, use the line total price, not the unit price.
                        4. Do not invent missing values.
                        5. If a field is missing or unreadable, omit it.
                        6. Return only valid JSON. Do not include markdown.

                        Use this JSON structure:
                        {
                          "receiptId": "string",
                          "merchantName": "string",
                          "customerName": "string",
                          "date": "yyyy-MM-dd",
                          "tax": number,
                          "discount": number,
                          "total": number,
                          "paymentMethod": "cash | creditCard | debitCard | eMoney",
                          "currency": "3-letter currency code",
                          "items": [
                            {
                              "name": "string",
                              "price": number,
                              "quantity": number
                            }
                          ]
                        }`
              },
              { inline_data: { mime_type: "image/jpeg", data: base64Image } }
            ]
          }]
        })
      });

      const data = await response.json();
      if (data.error) {
        console.error("Gemini API Error:", data.error);
        throw new Error(data.error.message);

      }
      const textOutput = data.candidates?.[0]?.contents?.parts?.[0]?.text ?? '';
      const cleanedOutput = textOutput.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
      
      const normalizeWhitespace = (value) => {
        if (typeof value !== 'string') {
          return value;
        }
        return value.replace(/\s+/g, '').trim();
      };

      const parsedReceipt = JSON.parse(cleanedOutput);
      const reciptItems = Array.isArray(parsedReceipt.items) ? parsedReceipt.items : [];
      const normalizedItems = reciptItems.map((item) => ({
        item_name: normalizeWhitespace(item.name ?? ''),
        quantity: normalizeWhitespace(String(item.quantity ?? '')),
        price: normalizeWhitespace(String(item.price ?? '')),
        receipt_id: normalizeWhitespace(parsedReceipt.receiptId ?? ''),
        merchant_name: normalizeWhitespace(parsedReceipt.merchantName ?? ''),
        customer_name: normalizeWhitespace(parsedReceipt.customerName ?? ''),
        receipt_date: normalizeWhitespace(parsedReceipt.date ?? ''),
        tax: normalizeWhitespace(String(parsedReceipt.tax ?? '')),
        discount: normalizeWhitespace(String(parsedReceipt.discount ?? '')),
        total: normalizeWhitespace(String(parsedReceipt.total ?? '')),
        payment_method: normalizeWhitespace(parsedReceipt.paymentMethod ?? 'cash'),
        currency: (normalizeWhitespace(parsedReceipt.currency ?? '')),
        raw_receipt_json: cleanedOutput, 
      })).filter((item) => item.item_name.length > 0);

      setParsedItems(normalizedItems);
      let generatedCsv = "Item,Quantity,Price\n";
      generatedCsv += `${item.item_name},${item.quantity},${item.price}\n`;

      setCsvData(generatedCsv); //turn json into csv values

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
        throw new Error("You must be logged in.");
      }

      const userId = userData.user.id;

      // prepare data for Supabase insertion
      const insertData = parsedItems.map(item => ({
        user_id: userId,
        item_name: item.item_name,
        quantity: String(item.quantity),
        price: item.price || null,
        category: item.category || null,
        receipt_id: item.receipt_id || null,
        merchant_name: item.merchant_name || null,
        customer_name: item.customer_name || null,
        receipt_data: item.receipt_date || null,
        tax: item.tax || null,
        discount: item.discount || null,
        total: item.total || null,
        payment_method: item.payment_method || 'cash',
        currency: item.currency || null,
        raw_receipt_json: item.raw_receipt_json || null,
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

      {/*TODO: Display the extracted text for the user to confirm */}
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