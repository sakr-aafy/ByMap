// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import Welcome         from './src/screens/Welcome';
import MapScreen       from './src/screens/MapScreen';
import LoginScreen     from './src/screens/LoginScreen';
import LocalScreen     from './src/screens/LocalScreen';
import ProfileScreen   from './src/screens/ProfileScreen';   // ← NOUVEAU
import AdminDashboard  from './src/screens/admin/AdminDashboard';
import AjoutePub          from './src/screens/AjoutPub';
import PublicationDetail  from './src/screens/PublicationDetail';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Welcome"        component={Welcome}         />
        <Stack.Screen name="Map"            component={MapScreen}       />
        <Stack.Screen name="Login"          component={LoginScreen}     />
        <Stack.Screen name="Local"          component={LocalScreen}     />
        <Stack.Screen name="Profile"        component={ProfileScreen}   />
        <Stack.Screen name="AdminDashboard" component={AdminDashboard}  />
        <Stack.Screen name="AjoutePub"         component={AjoutePub}          />
        <Stack.Screen name="PublicationDetail" component={PublicationDetail}   />
      </Stack.Navigator>
    </NavigationContainer>
  );
}