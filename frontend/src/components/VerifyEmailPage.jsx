import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Typography, Button, Input, Alert, Space } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import {
  verifyEmail,
  resendVerification,
  logout,
  selectUser,
  selectVerifyStatus,
  selectVerifyError,
  selectResendStatus,
} from '../store/authSlice';

const { Title, Text } = Typography;

const VerifyEmailPage = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const verifyStatus = useSelector(selectVerifyStatus);
  const verifyError = useSelector(selectVerifyError);
  const resendStatus = useSelector(selectResendStatus);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  const email = user?.email || '';

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (newCode.every((d) => d !== '') && newCode.join('').length === 6) {
      dispatch(verifyEmail({ email, code: newCode.join('') }));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste.length === 6) {
      const newCode = paste.split('');
      setCode(newCode);
      dispatch(verifyEmail({ email, code: paste }));
      e.preventDefault();
    }
  };

  const handleResend = () => {
    dispatch(resendVerification({ email }));
  };

  const handleLogout = () => {
    dispatch(logout());
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
        width: 420,
        padding: '40px 32px',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        textAlign: 'center',
      }}>
        <MailOutlined style={{ fontSize: 48, color: '#2563eb', marginBottom: 16 }} />
        <Title level={3}>Verify Your Email</Title>
        <Text type="secondary">
          We sent a 6-digit verification code to <strong>{email}</strong>.
          Enter it below to verify your account.
        </Text>

        {verifyError && (
          <Alert
            message={verifyError}
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {verifyStatus === 'succeeded' && (
          <Alert
            message="Email verified successfully!"
            type="success"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '24px 0' }} onPaste={handlePaste}>
          {code.map((digit, i) => (
            <Input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              maxLength={1}
              style={{
                width: 48,
                height: 48,
                textAlign: 'center',
                fontSize: 20,
                fontWeight: 600,
              }}
            />
          ))}
        </div>

        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            type="link"
            onClick={handleResend}
            loading={resendStatus === 'loading'}
            disabled={resendStatus === 'loading'}
          >
            {resendStatus === 'succeeded' ? 'Code resent!' : "Didn't receive a code? Resend"}
          </Button>

          <Button type="text" size="small" onClick={handleLogout}>
            Use a different account
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
