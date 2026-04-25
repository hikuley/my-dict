import { Provider, useSelector } from 'react-redux';
import { ConfigProvider } from 'antd';
import store from './store';
import WordList from './components/WordList';
import AuthPage from './components/AuthPage';
import VerifyEmailPage from './components/VerifyEmailPage';
import { selectIsAuthenticated, selectUser } from './store/authSlice';

const AppContent = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  if (user && !user.isVerified) {
    return <VerifyEmailPage />;
  }

  return <WordList />;
};

const App = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 6,
        },
      }}
    >
      <Provider store={store}>
        <AppContent />
      </Provider>
    </ConfigProvider>
  );
};

export default App;
