import { router } from 'expo-router';
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen(){
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSignIn(){
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });
        setLoading(false);

        if (error){
            Alert.alert('Sign in failed', error.message);
        }
    }

    function handleGoToSignup() {
        router.push('/signup');
    }

    return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 24}}>
            <Text style = {{fontSize: 28, fontWeight: '700', marginBottom: 8}}>
                ArrowBerry
            </Text>
            <Text style = {{fontSize: 16, marginBottom: 20}}>
                Login to Continue
            </Text>

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
                    onPress = {handleSignIn}
                    disabled ={loading}
                    style = {{
                        backgroundColor: '#111',
                        padding: 14,
                        borderRadius: 8,
                        alignItems: 'center',
                        marginBottom: 12,
                    }}
                    >
                        <Text style = {{color: '#fff', fontWeight: '600'}}>
                            {loading ? 'Loading . . .' : 'Sign In'}
                        </Text>
                    </Pressable>

                <Pressable
                    onPress={handleGoToSignup}
                    disabled={loading}
                    style={{
                        borderWidth: 1,
                        borderColor: '#111',
                        padding: 12,
                        borderRadius: 8,
                        alignItems: 'center',
                    }}
                    >
                        <Text style= {{fontWeight : '600'}}>Create Account</Text>
                    </Pressable>
        </View>
    );
}