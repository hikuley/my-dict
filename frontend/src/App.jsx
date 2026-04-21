import { Provider } from 'react-redux';
import { ConfigProvider } from 'antd';
import store from './store';
import WordList from './components/WordList';

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
        <WordList />
      </Provider>
    </ConfigProvider>
  );
};

export default App;
