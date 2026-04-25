import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Form, Input, Button, Typography, Divider, Alert, Space } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { signUp, login, googleAuth, clearAuthError, selectAuthStatus, selectAuthError } from '../store/authSlice';

const { Title, Text, Link } = Typography;

const AuthPage = () => {
  const dispatch = useDispatch();
  const status = useSelector(selectAuthStatus);
  const error = useSelector(selectAuthError);
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form] = Form.useForm();
  const googleBtnRef = useRef(null);

  const loading = status === 'loading';

  const handleSubmit = (values) => {
    dispatch(clearAuthError());
    if (mode === 'signup') {
      dispatch(signUp({ name: values.name, email: values.email, password: values.password }));
    } else {
      dispatch(login({ email: values.email, password: values.password }));
    }
  };

  useEffect(() => {
    if (!window.google || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      callback: (response) => {
        dispatch(googleAuth({ idToken: response.credential }));
      },
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'outline',
      size: 'large',
      width: 336,
      text: 'continue_with',
    });
  }, [dispatch]);

  const switchMode = () => {
    dispatch(clearAuthError());
    form.resetFields();
    setMode(mode === 'login' ? 'signup' : 'login');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f5',
    }}>
      <div style={{
        width: 400,
        padding: '40px 32px',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>📚 My Dictionary</Title>
          <Text type="secondary">
            {mode === 'login' ? 'Welcome back! Log in to continue.' : 'Create an account to get started.'}
          </Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => dispatch(clearAuthError())}
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          requiredMark={false}
        >
          {mode === 'signup' && (
            <Form.Item
              name="name"
              rules={[{ required: true, message: 'Please enter your name' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Full Name"
                size="large"
              />
            </Form.Item>
          )}

          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="Email"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Please enter your password' },
              ...(mode === 'signup' ? [{ min: 8, message: 'Password must be at least 8 characters' }] : []),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              {mode === 'login' ? 'Log In' : 'Sign Up'}
            </Button>
          </Form.Item>
        </Form>

        <Divider plain>or</Divider>

        <div
          ref={googleBtnRef}
          style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}
        />

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          </Text>
          <Link onClick={switchMode}>
            {mode === 'login' ? 'Sign Up' : 'Log In'}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
