import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../lib/supabase';
import LoginScreen from './login';
import TabNavigator from './navigation/TabNavigator';

export default function Index(){
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function getInitialSession(){
      const {data, error} = await supabase.auth.getSession();
      if (!mounted) return;

      if (error){
        console.error('Error getting session', error.message);
      }
      setSession(data.session ?? null);
      setLoading(false);
    }
    getInitialSession();

    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style = {{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large"/>
      </View>
    );
  }

  if (!session){
    return <LoginScreen />;
  }
  return <TabNavigator />;
}