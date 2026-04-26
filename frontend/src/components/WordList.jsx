import { useEffect, useRef, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Table, Input, Button, Space, Modal, Progress, notification, Typography } from 'antd';
import {
  SyncOutlined,
  PlusOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  RightOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  fetchWords,
  selectAllWords,
  selectPage,
  selectTotalPages,
  selectTotal,
  selectWordsStatus,
  searchWords,
  clearSearch,
  selectSearchResults,
  selectSearchQuery,
  selectSearchStatus,
  generateWord,
  resetGenerateStatus,
} from '../store/wordsSlice';
import { logout, selectUser, selectToken } from '../store/authSlice';
import useWebSocket from '../hooks/useWebSocket';
import useProgressBars from '../hooks/useProgressBars';
import AddWordModal from './AddWordModal';
import WordDetailModal from './WordDetailModal';

const { Text } = Typography;

const WordList = ({ onOpenProfile }) => {
  const dispatch = useDispatch();
  const words = useSelector(selectAllWords);
  const searchResults = useSelector(selectSearchResults);
  const searchQuery = useSelector(selectSearchQuery);
  const page = useSelector(selectPage);
  const totalPages = useSelector(selectTotalPages);
  const total = useSelector(selectTotal);
  const wordsStatus = useSelector(selectWordsStatus);
  const searchStatus = useSelector(selectSearchStatus);
  const user = useSelector(selectUser);
  const token = useSelector(selectToken);

  const isSearching = searchQuery.length >= 2;
  const tableLoading = isSearching ? searchStatus === 'loading' : wordsStatus === 'loading';
  const displayWords = isSearching ? searchResults : words;

  const searchInputRef = useRef(null);
  const searchTimerRef = useRef(null);
  const [selectedRowKey, setSelectedRowKey] = useState(null);
  const selectedRowKeyRef = useRef(selectedRowKey);
  selectedRowKeyRef.current = selectedRowKey;
  const displayWordsRef = useRef(displayWords);
  displayWordsRef.current = displayWords;
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailSlug, setDetailSlug] = useState(null);
  const detailSlugRef = useRef(detailSlug);
  detailSlugRef.current = detailSlug;
  const [detailTitle, setDetailTitle] = useState('');

  const { bars, addBar, completeBar, removeBar } = useProgressBars();

  useEffect(() => {
    dispatch(fetchWords({ page: 1 }));
  }, [dispatch]);

  // Global keyboard listener: focus search field on letter press, arrow key row navigation
  useEffect(() => {
    function isEditableElement(el) {
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = (el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select';
    }

    function onKeyDown(e) {
      // Skip all keyboard shortcuts when word detail modal is open
      if (detailSlugRef.current) return;

      const editable = isEditableElement(e.target) || isEditableElement(document.activeElement);

      // Arrow key row navigation (works globally, even after clicking a row)
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !editable) {
        e.preventDefault();
        const data = displayWordsRef.current;
        if (!data.length) return;

        setSelectedRowKey((prev) => {
          const currentIdx = prev ? data.findIndex((w) => w.slug === prev) : -1;
          if (e.key === 'ArrowDown') {
            const nextIdx = currentIdx < data.length - 1 ? currentIdx + 1 : 0;
            return data[nextIdx].slug;
          } else {
            const prevIdx = currentIdx > 0 ? currentIdx - 1 : data.length - 1;
            return data[prevIdx].slug;
          }
        });
        return;
      }

      // Enter opens detail for selected row
      if (e.key === 'Enter' && !editable && selectedRowKeyRef.current) {
        const word = displayWordsRef.current.find((w) => w.slug === selectedRowKeyRef.current);
        if (word) openDetail(word);
        return;
      }

      if (editable) return;
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Handle WebSocket messages
  useWebSocket((msg) => {
    if (msg.type === 'word-processing') {
      addBar(msg.data.slug, `Preparing "${msg.data.word}" with Claude AI...`, msg.data.startedAt);
    }
    if (msg.type === 'word-ready') {
      completeBar(msg.data.slug, `"${msg.data.word}" — Done!`);
      dispatch(fetchWords({ page: 1 }));
      notification.success({
        message: 'New Word Ready!',
        description: `"${msg.data.word}" has been added to the dictionary.`,
      });
    }
    if (msg.type === 'word-error') {
      removeBar(msg.data.slug);
      notification.error({
        message: 'Error',
        description: msg.data.error || 'Failed to generate word',
      });
    }
  });

  const handleSearch = useCallback((val) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (val.trim().length < 2) {
      dispatch(clearSearch());
    } else {
      searchTimerRef.current = setTimeout(() => {
        dispatch(searchWords(val.trim()));
      }, 300);
    }
  }, [dispatch]);

  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const data = displayWords;
      if (!data.length) return;

      setSelectedRowKey((prev) => {
        const currentIdx = prev ? data.findIndex((w) => w.slug === prev) : -1;
        if (e.key === 'ArrowDown') {
          const nextIdx = currentIdx < data.length - 1 ? currentIdx + 1 : 0;
          return data[nextIdx].slug;
        } else {
          const prevIdx = currentIdx > 0 ? currentIdx - 1 : data.length - 1;
          return data[prevIdx].slug;
        }
      });
    } else if (e.key === 'Enter') {
      if (selectedRowKey) {
        const word = displayWords.find((w) => w.slug === selectedRowKey);
        if (word) openDetail(word);
      }
    } else if (e.key === 'Backspace' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (searchInputRef.current) {
        // Clear the input value via the native input element
        const nativeInput = searchInputRef.current.input;
        if (nativeInput) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          ).set;
          nativeInputValueSetter.call(nativeInput, '');
          nativeInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      handleSearch('');
    }
  }, [displayWords, selectedRowKey, handleSearch]);

  const openDetail = (word) => {
    setDetailSlug(word.slug);
    setDetailTitle(word.title);
  };

  const handleDelete = (word) => {
    Modal.confirm({
      title: 'Delete',
      content: `Are you sure you want to delete "${word.title}"?`,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: () => {
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return fetch('/api/words/' + encodeURIComponent(word.slug), { method: 'DELETE', headers })
          .then((res) => {
            if (!res.ok) throw new Error('Delete failed');
            dispatch(fetchWords({ page: 1 }));
          })
          .catch(() => {
            notification.error({ message: 'Error', description: 'Failed to delete the word.' });
          });
      },
    });
  };

  const columns = [
    {
      title: 'Word',
      dataIndex: 'title',
      key: 'title',
      width: '30%',
      render: (text) => (
        <Text strong style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {text}
        </Text>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'subtitle',
      key: 'subtitle',
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={(e) => { e.stopPropagation(); handleDelete(record); }}
            title="Delete"
          />
          <Button
            type="text"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={(e) => { e.stopPropagation(); openDetail(record); }}
            title="Detail"
          />
        </Space>
      ),
    },
  ];

  const barEntries = Array.from(bars.entries());

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        background: '#fff',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: '18px', fontWeight: 600 }}>📚 My Dictionary</div>
        <Space>
          {user && <Text type="secondary">{user.name}</Text>}
          <Button
            type="text"
            icon={<UserOutlined />}
            onClick={onOpenProfile}
            title="Profile"
          />
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={() => dispatch(logout())}
            title="Log out"
          />
        </Space>
      </div>

      {/* Progress bars */}
      {barEntries.length > 0 && (
        <div style={{ padding: '8px 20px 0', background: '#fff' }}>
          {barEntries.map(([slug, entry]) => (
            <div key={slug} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>{entry.text}</div>
              <Progress
                percent={Math.round(entry.progress * 100)}
                size="small"
                showInfo={false}
                strokeColor="#2563eb"
              />
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ padding: '10px 20px', background: '#fff', borderBottom: '1px solid #e8e8e8' }}>
        <Space style={{ width: '100%' }}>
          <Input
            ref={searchInputRef}
            placeholder="Search words... (min 2 letters)"
            allowClear
            style={{ width: 400 }}
            onChange={(e) => handleSearch(e.target.value || '')}
            onKeyDown={handleSearchKeyDown}
          />
          <Button
            icon={<SyncOutlined />}
            loading={wordsStatus === 'loading'}
            onClick={() => dispatch(fetchWords({ page }))}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddModalOpen(true)}
          >
            Add Word
          </Button>
        </Space>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <Table
          dataSource={displayWords}
          columns={columns}
          rowKey="slug"
          pagination={false}
          loading={tableLoading}
          size="middle"
          style={{ marginTop: 8 }}
          rowClassName={(record) => record.slug === selectedRowKey ? 'ant-table-row-selected' : ''}
          onRow={(record) => ({
            onDoubleClick: () => openDetail(record),
            onClick: () => setSelectedRowKey(record.slug),
          })}
        />
      </div>

      {/* Footer pagination */}
      {!isSearching && (
        <div style={{
          padding: '8px 20px',
          background: '#fff',
          borderTop: '1px solid #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Text>Total: <Text strong>{total}</Text></Text>
          <Space>
            <Button
              icon={<LeftOutlined />}
              size="small"
              disabled={page <= 1 || wordsStatus === 'loading'}
              onClick={() => dispatch(fetchWords({ page: page - 1 }))}
            />
            <Text>Page {page} / {totalPages}</Text>
            <Button
              icon={<RightOutlined />}
              size="small"
              disabled={page >= totalPages || wordsStatus === 'loading'}
              onClick={() => dispatch(fetchWords({ page: page + 1 }))}
            />
          </Space>
          <div style={{ width: 80 }} />
        </div>
      )}

      {/* Modals */}
      <AddWordModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={async (word) => {
          const result = await dispatch(generateWord(word)).unwrap();
          dispatch(resetGenerateStatus());
          addBar(result.slug, `Processing "${result.word || word}" with Claude AI...`);
        }}
        onCancel={() => dispatch(resetGenerateStatus())}
      />

      {detailSlug && (
        <WordDetailModal
          slug={detailSlug}
          title={detailTitle}
          onClose={() => {
            setDetailSlug(null);
            setDetailTitle('');
          }}
        />
      )}
    </div>
  );
};

export default WordList;
