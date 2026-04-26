import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const API_BASE = '/api/profile';

const getAuthHeaders = (getState) => {
  const { auth } = getState();
  const headers = { 'Content-Type': 'application/json' };
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
  return headers;
};

export const fetchProfile = createAsyncThunk('profile/fetchProfile', async (_, { getState, rejectWithValue }) => {
  const res = await fetch(API_BASE, { headers: getAuthHeaders(getState) });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.error || 'Failed to fetch profile');
  return data;
});

export const updateProfile = createAsyncThunk('profile/updateProfile', async ({ name, surname }, { getState, rejectWithValue }) => {
  const res = await fetch(API_BASE, {
    method: 'PUT',
    headers: getAuthHeaders(getState),
    body: JSON.stringify({ name, surname }),
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.error || 'Failed to update profile');
  return data;
});

export const updatePassword = createAsyncThunk('profile/updatePassword', async ({ currentPassword, newPassword }, { getState, rejectWithValue }) => {
  const res = await fetch(`${API_BASE}/password`, {
    method: 'PUT',
    headers: getAuthHeaders(getState),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.error || 'Failed to update password');
  return data;
});

export const initiateEmailChange = createAsyncThunk('profile/initiateEmailChange', async ({ newEmail }, { getState, rejectWithValue }) => {
  const res = await fetch(`${API_BASE}/email`, {
    method: 'POST',
    headers: getAuthHeaders(getState),
    body: JSON.stringify({ newEmail }),
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.error || 'Failed to initiate email change');
  return data;
});

export const verifyEmailChange = createAsyncThunk('profile/verifyEmailChange', async ({ code }, { getState, rejectWithValue }) => {
  const res = await fetch(`${API_BASE}/email/verify`, {
    method: 'POST',
    headers: getAuthHeaders(getState),
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.error || 'Failed to verify email change');
  return data;
});

const profileSlice = createSlice({
  name: 'profile',
  initialState: {
    profile: null,
    status: 'idle',
    error: null,
    updateStatus: 'idle',
    updateError: null,
    passwordStatus: 'idle',
    passwordError: null,
    emailChangeStatus: 'idle',
    emailChangeError: null,
    emailVerifyStatus: 'idle',
    emailVerifyError: null,
  },
  reducers: {
    clearProfileErrors(state) {
      state.error = null;
      state.updateError = null;
      state.passwordError = null;
      state.emailChangeError = null;
      state.emailVerifyError = null;
    },
    resetPasswordStatus(state) {
      state.passwordStatus = 'idle';
      state.passwordError = null;
    },
    resetEmailChangeStatus(state) {
      state.emailChangeStatus = 'idle';
      state.emailChangeError = null;
      state.emailVerifyStatus = 'idle';
      state.emailVerifyError = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch profile
    builder
      .addCase(fetchProfile.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.profile = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
    // Update profile
    builder
      .addCase(updateProfile.pending, (state) => { state.updateStatus = 'loading'; state.updateError = null; })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.profile = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload;
      });
    // Update password
    builder
      .addCase(updatePassword.pending, (state) => { state.passwordStatus = 'loading'; state.passwordError = null; })
      .addCase(updatePassword.fulfilled, (state) => { state.passwordStatus = 'succeeded'; })
      .addCase(updatePassword.rejected, (state, action) => {
        state.passwordStatus = 'failed';
        state.passwordError = action.payload;
      });
    // Initiate email change
    builder
      .addCase(initiateEmailChange.pending, (state) => { state.emailChangeStatus = 'loading'; state.emailChangeError = null; })
      .addCase(initiateEmailChange.fulfilled, (state) => { state.emailChangeStatus = 'succeeded'; })
      .addCase(initiateEmailChange.rejected, (state, action) => {
        state.emailChangeStatus = 'failed';
        state.emailChangeError = action.payload;
      });
    // Verify email change
    builder
      .addCase(verifyEmailChange.pending, (state) => { state.emailVerifyStatus = 'loading'; state.emailVerifyError = null; })
      .addCase(verifyEmailChange.fulfilled, (state, action) => {
        state.emailVerifyStatus = 'succeeded';
        state.profile = action.payload;
      })
      .addCase(verifyEmailChange.rejected, (state, action) => {
        state.emailVerifyStatus = 'failed';
        state.emailVerifyError = action.payload;
      });
  },
});

export const { clearProfileErrors, resetPasswordStatus, resetEmailChangeStatus } = profileSlice.actions;

export const selectProfile = (state) => state.profile.profile;
export const selectProfileStatus = (state) => state.profile.status;
export const selectProfileError = (state) => state.profile.error;
export const selectUpdateStatus = (state) => state.profile.updateStatus;
export const selectUpdateError = (state) => state.profile.updateError;
export const selectPasswordStatus = (state) => state.profile.passwordStatus;
export const selectPasswordError = (state) => state.profile.passwordError;
export const selectEmailChangeStatus = (state) => state.profile.emailChangeStatus;
export const selectEmailChangeError = (state) => state.profile.emailChangeError;
export const selectEmailVerifyStatus = (state) => state.profile.emailVerifyStatus;
export const selectEmailVerifyError = (state) => state.profile.emailVerifyError;

export default profileSlice.reducer;
