import { useState } from 'react';
import { Modal, Input, Typography } from 'antd';

const { Text } = Typography;

const AddWordModal = ({ open, onClose, onSubmit, onCancel }) => {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleOk = async () => {
    const word = value.trim();
    if (!word) return;

    setSubmitting(true);
    setError('');

    try {
      await onSubmit(word);
      setValue('');
      setError('');
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    setValue('');
    setError('');
    setSubmitting(false);
    onClose();
  };

  return (
    <Modal
      title="Add New Word"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Add Word"
      cancelText="Cancel"
      confirmLoading={submitting}
      okButtonProps={{ disabled: !value.trim() }}
      destroyOnClose
    >
      <div style={{ marginBottom: 12 }}>
        <Input
          placeholder="e.g. resilience, break down, carry out..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={handleOk}
          disabled={submitting}
          autoFocus
        />
        <div style={{ marginTop: 4, minHeight: 20 }}>
          {error && <Text type="danger">{error}</Text>}
          {submitting && !error && <Text type="secondary">Submitting...</Text>}
        </div>
      </div>
    </Modal>
  );
};

export default AddWordModal;
