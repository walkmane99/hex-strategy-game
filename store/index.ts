import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './slices/gameSlice';
import unitReducer from './slices/unitSlice';
import battleReducer from './slices/battleSlice';
import playerReducer from './slices/playerSlice';

export const store = configureStore({
  reducer: {
    game: gameReducer,
    units: unitReducer,
    battle: battleReducer,
    player: playerReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['units/initPlayerUnits', 'units/initEnemyUnits'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
