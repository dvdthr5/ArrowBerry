import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
      },
    });

    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', `${error.message} (${error.status ?? 'no status'})`);
      return;
    }

    Alert.alert('Success', 'Account created. You can now sign in.');
    router.replace('/login');
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
        Create Account
      </Text>

      <TextInput
        placeholder="Full Name"
        placeholderTextColor="rgba(0, 0, 0, 0.45)"
        value={name}
        onChangeText={setName}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}
      />

      <TextInput
        placeholder="Email"
        placeholderTextColor="rgba(0, 0, 0, 0.45)"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="rgba(0, 0, 0, 0.45)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}
      />

      <Pressable
        onPress={handleSignup}
        disabled={loading}
        style={{
          backgroundColor: '#111',
          padding: 14,
          borderRadius: 8,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>
          {loading ? 'Loading...' : 'Create Account'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        disabled={loading}
        style={{
          borderWidth: 1,
          borderColor: '#111',
          padding: 12,
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontWeight: '600' }}>Back to Login</Text>
      </Pressable>
    </View>
  );
}