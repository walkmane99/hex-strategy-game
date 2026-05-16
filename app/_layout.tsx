import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { store } from '@/store';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from '@/providers/DatabaseProvider';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <DatabaseProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#07090a' },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="tabs" />
            <Stack.Screen name="game" />
          </Stack>
        </DatabaseProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
