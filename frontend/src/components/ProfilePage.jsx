import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Card, Form, Input, Button, Typography, Progress, Space, Modal, Alert, Divider, Spin,
} from 'antd';
import { ArrowLeftOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import {
  fetchProfile,
  updateProfile,
  updatePassword,
  initiateEmailChange,
  verifyEmailChange,
  resetPasswordStatus,
  resetEmailChangeStatus,
  selectProfile,
  selectProfileStatus,
  selectUpdateStatus,
  selectUpdateError,
  selectPasswordStatus,
  selectPasswordError,
  selectEmailChangeStatus,
  selectEmailChangeError,
  selectEmailVerifyStatus,
  selectEmailVerifyError,
} from '../store/profileSlice';
import { selectUser } from '../store/authSlice';

const { Title, Text } = Typography;

const ProfilePage = ({ onBack }) => {
  const dispatch = useDispatch();
  const profile = useSelector(selectProfile);
  const profileStatus = useSelector(selectProfileStatus);
  const user = useSelector(selectUser);
  const updateStatus = useSelector(selectUpdateStatus);
  const updateError = useSelector(selectUpdateError);
  const passwordStatus = useSelector(selectPasswordStatus);
  const passwordError = useSelector(selectPasswordError);
  const emailChangeStatus = useSelector(selectEmailChangeStatus);
  const emailChangeError = useSelector(selectEmailChangeError);
  const emailVerifyStatus = useSelector(selectEmailVerifyStatus);
  const emailVerifyError = useSelector(selectEmailVerifyError);

  const [profileForm] = Form.useForm();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailCodeStep, setEmailCodeStep] = useState(false);
  const [passwordForm] = Form.useForm();
  const [emailForm] = Form.useForm();
  const [emailCodeForm] = Form.useForm();

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  useEffect(() => {
    if (profile) {
      profileForm.setFieldsValue({
        name: profile.name,
        surname: profile.surname || '',
      });
    }
  }, [profile, profileForm]);

  useEffect(() => {
    if (passwordStatus === 'succeeded') {
      setPasswordModalOpen(false);
      passwordForm.resetFields();
      dispatch(resetPasswordStatus());
    }
  }, [passwordStatus, passwordForm, dispatch]);

  useEffect(() => {
    if (emailChangeStatus === 'succeeded') {
      setEmailCodeStep(true);
    }
  }, [emailChangeStatus]);

  useEffect(() => {
    if (emailVerifyStatus === 'succeeded') {
      setEmailModalOpen(false);
      setEmailCodeStep(false);
      emailForm.resetFields();
      emailCodeForm.resetFields();
      dispatch(resetEmailChangeStatus());
      dispatch(fetchProfile());
    }
  }, [emailVerifyStatus, emailForm, emailCodeForm, dispatch]);

  const handleProfileSubmit = (values) => {
    dispatch(updateProfile({ name: values.name, surname: values.surname || null }));
  };

  const handlePasswordSubmit = (values) => {
    dispatch(updatePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }));
  };

  const handleEmailSubmit = (values) => {
    dispatch(initiateEmailChange({ newEmail: values.newEmail }));
  };

  const handleEmailCodeSubmit = (values) => {
    dispatch(verifyEmailChange({ code: values.code }));
  };

  const openEmailModal = () => {
    setEmailCodeStep(false);
    emailForm.resetFields();
    emailCodeForm.resetFields();
    dispatch(resetEmailChangeStatus());
    setEmailModalOpen(true);
  };

  if (profileStatus === 'loading' && !profile) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
        <Spin size="large" />
      </div>
    );
  }

  const usagePercent = profile ? Math.round((profile.usageCount / profile.usageLimit) * 100) : 0;
  const isGoogleUser = ['google', 'apple'].includes(user?.authType);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        background: '#fff',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
        <div style={{ fontSize: '18px', fontWeight: 600 }}>Profile</div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px', maxWidth: 600, margin: '0 auto', width: '100%' }}>
        {/* API Usage */}
        <Card title="API Usage" style={{ marginBottom: 16 }}>
          {profile && (
            <>
              <div style={{ marginBottom: 8 }}>
                <Text>
                  <Text strong>{profile.usageCount}</Text> / {profile.usageLimit} requests used this month
                </Text>
              </div>
              <Progress
                percent={usagePercent}
                strokeColor={usagePercent >= 90 ? '#ff4d4f' : usagePercent >= 70 ? '#faad14' : '#2563eb'}
                status={usagePercent >= 100 ? 'exception' : 'active'}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Resets monthly. Period started: {new Date(profile.periodStart).toLocaleDateString()}
                </Text>
              </div>
            </>
          )}
        </Card>

        {/* Personal Info */}
        <Card title="Personal Information" style={{ marginBottom: 16 }}>
          <Form
            form={profileForm}
            layout="vertical"
            onFinish={handleProfileSubmit}
          >
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: 'Name is required' }]}
            >
              <Input placeholder="Enter your name" />
            </Form.Item>
            <Form.Item
              name="surname"
              label="Surname"
            >
              <Input placeholder="Enter your surname" />
            </Form.Item>
            {updateError && (
              <Alert message={updateError} type="error" style={{ marginBottom: 16 }} showIcon />
            )}
            <Button
              type="primary"
              htmlType="submit"
              loading={updateStatus === 'loading'}
            >
              Save Changes
            </Button>
            {updateStatus === 'succeeded' && (
              <Text type="success" style={{ marginLeft: 12 }}>Saved!</Text>
            )}
          </Form>
        </Card>

        {/* Email */}
        <Card title="Email" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text>Current email: </Text>
              <Text strong>{profile?.email}</Text>
            </div>
            <Button icon={<MailOutlined />} onClick={openEmailModal}>
              Change Email
            </Button>
          </div>
        </Card>

        {/* Password (hidden for Google users) */}
        {!isGoogleUser && (
          <Card title="Password" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text>Update your password</Text>
              <Button
                icon={<LockOutlined />}
                onClick={() => {
                  passwordForm.resetFields();
                  dispatch(resetPasswordStatus());
                  setPasswordModalOpen(true);
                }}
              >
                Change Password
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Password Modal */}
      <Modal
        title="Change Password"
        open={passwordModalOpen}
        onCancel={() => setPasswordModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={passwordForm} layout="vertical" onFinish={handlePasswordSubmit}>
          <Form.Item
            name="currentPassword"
            label="Current Password"
            rules={[{ required: true, message: 'Current password is required' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: 'New password is required' },
              { min: 8, message: 'Password must be at least 8 characters' },
            ]}
          >
            <Input.Password />
          </Form.Item>
          {passwordError && (
            <Alert message={passwordError} type="error" style={{ marginBottom: 16 }} showIcon />
          )}
          <Button type="primary" htmlType="submit" loading={passwordStatus === 'loading'} block>
            Update Password
          </Button>
        </Form>
      </Modal>

      {/* Email Change Modal */}
      <Modal
        title="Change Email"
        open={emailModalOpen}
        onCancel={() => {
          setEmailModalOpen(false);
          setEmailCodeStep(false);
        }}
        footer={null}
        destroyOnClose
      >
        {!emailCodeStep ? (
          <Form form={emailForm} layout="vertical" onFinish={handleEmailSubmit}>
            <Form.Item
              name="newEmail"
              label="New Email"
              rules={[
                { required: true, message: 'Email is required' },
                { type: 'email', message: 'Invalid email format' },
              ]}
            >
              <Input placeholder="Enter new email address" />
            </Form.Item>
            {emailChangeError && (
              <Alert message={emailChangeError} type="error" style={{ marginBottom: 16 }} showIcon />
            )}
            <Button type="primary" htmlType="submit" loading={emailChangeStatus === 'loading'} block>
              Send Verification Code
            </Button>
          </Form>
        ) : (
          <Form form={emailCodeForm} layout="vertical" onFinish={handleEmailCodeSubmit}>
            <Alert
              message="A verification code has been sent to your new email address."
              type="info"
              style={{ marginBottom: 16 }}
              showIcon
            />
            <Form.Item
              name="code"
              label="Verification Code"
              rules={[{ required: true, message: 'Verification code is required' }]}
            >
              <Input placeholder="Enter 6-digit code" maxLength={6} />
            </Form.Item>
            {emailVerifyError && (
              <Alert message={emailVerifyError} type="error" style={{ marginBottom: 16 }} showIcon />
            )}
            <Button type="primary" htmlType="submit" loading={emailVerifyStatus === 'loading'} block>
              Verify & Change Email
            </Button>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default ProfilePage;
