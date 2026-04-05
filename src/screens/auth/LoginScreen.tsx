import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

function WOALogo() {
  return (
    <View style={logo.wrap}>
      <View style={logo.box}>
        <Text style={logo.text}>WORK(ER)</Text>
        <View style={logo.bottomRow}>
          <Text style={logo.text}>OF ART </Text>
          <Text style={logo.dot}>●</Text>
        </View>
      </View>
    </View>
  );
}

const logo = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 40 },
  box: {
    borderWidth: 1,
    borderColor: colors.white,
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.25 },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { color: colors.red, fontSize: 12 },
});

interface Props { navigation: any }

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email || !password) { setError('EMAIL AND PASSWORD REQUIRED.'); return; }
    setLoading(true);
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) { setError(loginError.message.toUpperCase()); return; }
      navigation.replace('Main');
    } catch (e: any) {
      setError(e.message?.toUpperCase() ?? 'SOMETHING WENT WRONG.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.prompt(
      'RESET PASSWORD',
      'Enter your email address.',
      async (val) => {
        if (!val?.trim()) return;
        const { error: err } = await supabase.auth.resetPasswordForEmail(val.trim());
        if (err) Alert.alert('ERROR', err.message);
        else Alert.alert('EMAIL SENT', 'Check your inbox for a reset link.');
      },
      'plain-text',
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <WOALogo />

          <View style={s.fieldWrap}>
            <Text style={s.label}>EMAIL</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.gray5}
              autoCorrect={false}
            />
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>PASSWORD</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholderTextColor={colors.gray5}
            />
          </View>

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity style={s.btn} onPress={handleLogin} activeOpacity={0.7} disabled={loading}>
            <Text style={s.btnText}>{loading ? 'LOGGING IN...' : 'LOG IN'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.forgotRow} onPress={handleForgotPassword} activeOpacity={0.7}>
            <Text style={s.forgotText}>FORGOT PASSWORD?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.replace('SignUp')} style={s.signupRow}>
            <Text style={s.signupText}>
              DON'T HAVE AN ACCOUNT?{' '}
              <Text style={s.signupBold}>SIGN UP</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  scroll: { paddingHorizontal: 28, paddingTop: 60, paddingBottom: 60 },
  fieldWrap: { marginBottom: 26 },
  label: { color: colors.gray5, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18, marginBottom: 8 },
  input: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    letterSpacing: 0.12,
  },
  errorText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18, marginBottom: 16 },
  btn: {
    borderWidth: 1,
    borderColor: colors.white,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  btnText: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.22 },
  forgotRow: { alignItems: 'center', marginBottom: 32 },
  forgotText: { color: colors.gray5, fontFamily: MONO, fontSize: 11, letterSpacing: 0.2 },
  signupRow: { alignItems: 'center' },
  signupText: { color: colors.gray5, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  signupBold: { color: colors.white },
});
