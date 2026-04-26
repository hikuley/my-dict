import { configureStore } from '@reduxjs/toolkit';
import wordsReducer from './wordsSlice';
import authReducer from './authSlice';
import profileReducer from './profileSlice';

const store = configureStore({
  reducer: {
    words: wordsReducer,
    auth: authReducer,
    profile: profileReducer,
  },
});

export default store;
