import { configureStore } from '@reduxjs/toolkit';
import wordsReducer from './wordsSlice';
import authReducer from './authSlice';

const store = configureStore({
  reducer: {
    words: wordsReducer,
    auth: authReducer,
  },
});

export default store;
