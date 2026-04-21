import { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Collapse, Spin, Typography } from 'antd';
import { SoundOutlined } from '@ant-design/icons';

const { Text } = Typography;

let preferredVoice = null;

function loadBritishVoice() {
  const voices = window.speechSynthesis.getVoices();
  preferredVoice =
    voices.find((v) => v.lang === 'en-GB' && v.name.indexOf('Female') !== -1) ||
    voices.find((v) => v.lang === 'en-GB') ||
    voices.find((v) => v.lang.startsWith('en')) ||
    null;
}

if (window.speechSynthesis) {
  loadBritishVoice();
  window.speechSynthesis.onvoiceschanged = loadBritishVoice;
}

function speak(text) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-GB';
  utter.rate = 0.9;
  if (preferredVoice) utter.voice = preferredVoice;
  window.speechSynthesis.speak(utter);
}

function injectSpeakButtons(container) {
  if (!container) return;

  function createSpeakBtn(text, extraCls) {
    const btn = document.createElement('button');
    btn.className = 'speak-btn' + (extraCls ? ' ' + extraCls : '');
    btn.innerHTML = '🔊';
    btn.title = 'Listen';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      speak(text);
    });
    return btn;
  }

  // .en elements (example sentences)
  container.querySelectorAll('.example-item .en').forEach((el) => {
    if (el.querySelector('.speak-btn')) return;
    const text = el.textContent.trim();
    if (text) el.appendChild(createSpeakBtn(text));
  });

  // .structure-box .example
  container.querySelectorAll('.structure-box .example').forEach((el) => {
    if (el.querySelector('.speak-btn')) return;
    const text = el.textContent.trim();
    if (text) el.appendChild(createSpeakBtn(text));
  });

  // English Definition cells
  container.querySelectorAll('table').forEach((table) => {
    const headers = table.querySelectorAll('thead th');
    let enColIdx = -1;
    headers.forEach((th, i) => {
      if (/english/i.test(th.textContent)) enColIdx = i;
    });
    if (enColIdx !== -1) {
      table.querySelectorAll('tbody tr').forEach((row) => {
        const cell = row.querySelectorAll('td')[enColIdx];
        if (cell && !cell.querySelector('.speak-btn')) {
          const text = cell.textContent.trim();
          if (text) cell.appendChild(createSpeakBtn(text));
        }
      });
    }
  });

  // English sentence cells (first column)
  container.querySelectorAll('table td:first-child').forEach((el) => {
    if (el.querySelector('.speak-btn')) return;
    const text = el.textContent.trim();
    if (text && text.indexOf(' ') !== -1 && /^[A-Z]/.test(text) && text.length > 10) {
      el.appendChild(createSpeakBtn(text));
    }
  });
}

const WordDetailModal = ({ slug, title, onClose }) => {
  const [word, setWord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeKey, setActiveKey] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setWord(null);
    setActiveKey(null);

    fetch('/api/words/' + encodeURIComponent(slug))
      .then((res) => res.json())
      .then((data) => {
        setWord(data);
        if (data.sections && data.sections.length > 0) {
          setActiveKey(String(0));
        }
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [slug]);

  // Inject speak buttons after content renders or accordion changes
  const injectButtons = useCallback(() => {
    setTimeout(() => {
      if (contentRef.current) {
        injectSpeakButtons(contentRef.current);
      }
    }, 100);
  }, []);

  useEffect(() => {
    if (word) injectButtons();
  }, [word, activeKey, injectButtons]);

  const handleClose = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    onClose();
  };

  const collapseItems = word?.sections?.map((section, index) => ({
    key: String(index),
    label: `${section.icon} ${section.title}`,
    children: (
      <div
        className="section-content"
        dangerouslySetInnerHTML={{ __html: section.content }}
      />
    ),
  })) || [];

  return (
    <Modal
      title={title}
      open={true}
      onCancel={handleClose}
      footer={null}
      width={700}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', color: 'red', padding: 20 }}>
          Failed to load word details.
        </div>
      )}

      {word && !loading && (
        <div ref={contentRef}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div>
              <Text type="secondary" style={{ fontSize: '1.1rem' }}>
                {word.phonetic || ''}
              </Text>
              {' '}
              <button
                className="speak-btn speak-btn-title"
                title="Listen to pronunciation"
                onClick={() => speak((word.title || title).toLowerCase())}
              >
                🔊
              </button>
            </div>
            <div>
              <Text type="secondary" italic>{word.title || title}</Text>
            </div>
            <div>
              <Text type="secondary" italic>{word.subtitle}</Text>
            </div>
          </div>

          {/* Sections */}
          <Collapse
            accordion
            activeKey={activeKey}
            onChange={(key) => setActiveKey(key)}
            items={collapseItems}
          />
        </div>
      )}
    </Modal>
  );
};

export default WordDetailModal;
