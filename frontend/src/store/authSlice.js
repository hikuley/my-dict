import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const API_BASE = '/api/auth';

export const signUp = createAsyncThunk('auth/signUp', async ({ name, email, password }, { rejectWithValue }) => {
  const res = await fetch(`${API_BASE}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.error || 'Sign up failed');
  return data;
});

export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.error || 'Login failed');
  return data;
});

export const verifyEmail = createAsyncThunk('auth/verifyEmail', async ({ email, code }, { rejectWithValue }) => {
  const res = await fetch(`${API_BASE}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.error || 'Verification failed');
  return data;
});

export const resendVerification = createAsyncThunk('auth/resendVerification', async ({ email }, { rejectWithValue }) => {
  const res = await fetch(`${API_BASE}/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.error || 'Failed to resend');
  return data;
});

export const googleAuth = createAsyncThunk('auth/googleAuth', async ({ idToken }, { rejectWithValue }) => {
  const res = await fetch(`${API_BASE}/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.error || 'Google auth failed');
  return data;
});

export const appleAuth = createAsyncThunk('auth/appleAuth', async ({ idToken, name }, { rejectWithValue }) => {
  const res = await fetch(`${API_BASE}/apple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, name }),
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.error || 'Apple auth failed');
  return data;
});

export const fetchCurrentUser = createAsyncThunk('auth/fetchCurrentUser', async (_, { getState, rejectWithValue }) => {
  const { auth } = getState();
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.error || 'Failed to fetch user');
  return data;
});

const savedToken = localStorage.getItem('token');
const savedUser = localStorage.getItem('user');

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: savedToken || null,
    user: savedUser ? JSON.parse(savedUser) : null,
    status: 'idle',
    error: null,
    verifyStatus: 'idle',
    verifyError: null,
    resendStatus: 'idle',
  },
  reducers: {
    logout(state) {
      state.token = null;
      state.user = null;
      state.status = 'idle';
      state.error = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    clearAuthError(state) {
      state.error = null;
    },
    markVerified(state) {
      if (state.user) {
        state.user.isVerified = true;
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    },
  },
  extraReducers: (builder) => {
    // Sign Up
    builder
      .addCase(signUp.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(signUp.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.user = action.payload.user;
        localStorage.setItem('token', action.payload.token);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
      })
      .addCase(signUp.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
    // Login
    builder
      .addCase(login.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.user = action.payload.user;
        localStorage.setItem('token', action.payload.token);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
    // Google Auth
    builder
      .addCase(googleAuth.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(googleAuth.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.user = action.payload.user;
        localStorage.setItem('token', action.payload.token);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
      })
      .addCase(googleAuth.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
    // Apple Auth
    builder
      .addCase(appleAuth.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(appleAuth.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.user = action.payload.user;
        localStorage.setItem('token', action.payload.token);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
      })
      .addCase(appleAuth.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
    // Verify Email
    builder
      .addCase(verifyEmail.pending, (state) => { state.verifyStatus = 'loading'; state.verifyError = null; })
      .addCase(verifyEmail.fulfilled, (state) => {
        state.verifyStatus = 'succeeded';
        if (state.user) {
          state.user.isVerified = true;
          localStorage.setItem('user', JSON.stringify(state.user));
        }
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.verifyStatus = 'failed';
        state.verifyError = action.payload;
      });
    // Resend Verification
    builder
      .addCase(resendVerification.pending, (state) => { state.resendStatus = 'loading'; })
      .addCase(resendVerification.fulfilled, (state) => { state.resendStatus = 'succeeded'; })
      .addCase(resendVerification.rejected, (state) => { state.resendStatus = 'failed'; });
    // Fetch Current User
    builder
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
        localStorage.setItem('user', JSON.stringify(action.payload));
      });
  },
});

export const { logout, clearAuthError, markVerified } = authSlice.actions;

export const selectToken = (state) => state.auth.token;
export const selectUser = (state) => state.auth.user;
export const selectAuthStatus = (state) => state.auth.status;
export const selectAuthError = (state) => state.auth.error;
export const selectIsAuthenticated = (state) => !!state.auth.token;
export const selectIsVerified = (state) => state.auth.user?.isVerified ?? false;
export const selectVerifyStatus = (state) => state.auth.verifyStatus;
export const selectVerifyError = (state) => state.auth.verifyError;
export const selectResendStatus = (state) => state.auth.resendStatus;

export default authSlice.reducer;
