import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Fetch words with pagination
export const fetchWords = createAsyncThunk('words/fetchWords', async ({ page = 1, limit = 20 } = {}) => {
  const response = await fetch(`/api/words?page=${page}&limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to load word data');
  }
  return await response.json();
});

// Fetch single word detail by slug
export const fetchWordBySlug = createAsyncThunk('words/fetchWordBySlug', async (slug) => {
  const response = await fetch(`/api/words/${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error('Word not found');
  }
  return await response.json();
});

// Search words via full-text search
export const searchWords = createAsyncThunk('words/searchWords', async (query) => {
  const response = await fetch(`/api/words/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error('Search failed');
  }
  const data = await response.json();
  return data.words;
});

// Queue a new word for async generation via Kafka
export const generateWord = createAsyncThunk('words/generateWord', async (word) => {
  const response = await fetch('/api/words/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to queue word');
  }
  return await response.json();
});

const wordsSlice = createSlice({
  name: 'words',
  initialState: {
    items: [],
    status: 'idle',
    error: null,
    page: 1,
    totalPages: 1,
    total: 0,
    // Word detail cache
    currentWord: null,
    currentWordStatus: 'idle',
    currentWordError: null,
    // Search state
    searchResults: [],
    searchQuery: '',
    searchStatus: 'idle',
    // Generate word state
    generateStatus: 'idle',
    generateError: null,
  },
  reducers: {
    clearSearch(state) {
      state.searchResults = [];
      state.searchQuery = '';
      state.searchStatus = 'idle';
    },
    resetGenerateStatus(state) {
      state.generateStatus = 'idle';
      state.generateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchWords
      .addCase(fetchWords.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchWords.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.words;
        state.page = action.payload.page;
        state.totalPages = action.payload.totalPages;
        state.total = action.payload.total;
      })
      .addCase(fetchWords.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      })
      // fetchWordBySlug
      .addCase(fetchWordBySlug.pending, (state) => {
        state.currentWordStatus = 'loading';
        state.currentWord = null;
        state.currentWordError = null;
      })
      .addCase(fetchWordBySlug.fulfilled, (state, action) => {
        state.currentWordStatus = 'succeeded';
        state.currentWord = action.payload;
      })
      .addCase(fetchWordBySlug.rejected, (state, action) => {
        state.currentWordStatus = 'failed';
        state.currentWordError = action.error.message;
      })
      // searchWords
      .addCase(searchWords.pending, (state, action) => {
        state.searchStatus = 'loading';
        state.searchQuery = action.meta.arg;
      })
      .addCase(searchWords.fulfilled, (state, action) => {
        state.searchStatus = 'succeeded';
        state.searchResults = action.payload;
      })
      .addCase(searchWords.rejected, (state, action) => {
        state.searchStatus = 'failed';
      })
      // generateWord
      .addCase(generateWord.pending, (state) => {
        state.generateStatus = 'loading';
        state.generateError = null;
      })
      .addCase(generateWord.fulfilled, (state, action) => {
        state.generateStatus = 'succeeded';
        state.total += 1;
        state.totalPages = Math.ceil(state.total / 10);
      })
      .addCase(generateWord.rejected, (state, action) => {
        state.generateStatus = 'failed';
        state.generateError = action.error.message;
      });
  },
});

export const { clearSearch, resetGenerateStatus } = wordsSlice.actions;

export const selectAllWords = (state) => state.words.items;
export const selectWordsStatus = (state) => state.words.status;
export const selectWordsError = (state) => state.words.error;
export const selectPage = (state) => state.words.page;
export const selectTotalPages = (state) => state.words.totalPages;
export const selectTotal = (state) => state.words.total;

export const selectCurrentWord = (state) => state.words.currentWord;
export const selectCurrentWordStatus = (state) => state.words.currentWordStatus;
export const selectCurrentWordError = (state) => state.words.currentWordError;

export const selectSearchResults = (state) => state.words.searchResults;
export const selectSearchQuery = (state) => state.words.searchQuery;
export const selectSearchStatus = (state) => state.words.searchStatus;

export const selectGenerateStatus = (state) => state.words.generateStatus;
export const selectGenerateError = (state) => state.words.generateError;

export default wordsSlice.reducer;
