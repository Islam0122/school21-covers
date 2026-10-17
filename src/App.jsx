import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import { EXPORT_SCALE, SCHOOL, canvasToPngBlob, renderCover } from './lib/cover';
import { buildDocx } from './lib/docx';
import './App.css';

const EMPTY = { fullName: '', className: '', year: '' };
const YEAR_RE = /^\s*(\d{4})\s*[-–—]\s*(\d{4})\s*$/;

/** «2026-2027» → «2026–2027» */
function normalizeYear(v) {
  const m = v.match(YEAR_RE);
  return m ? `${m[1]}–${m[2]}` : v.trim();
}

function normalize(d) {
  const clean = (s) => s.trim().replace(/\s+/g, ' ');
  return { fullName: clean(d.fullName), className: clean(d.className), year: normalizeYear(d.year) };
}

function validate(d) {
  const e = {};
  if (!d.fullName.trim()) e.fullName = 'Введите ФИО ученика.';
  if (!d.className.trim()) e.className = 'Введите класс, например 9-А.';
  if (!d.year.trim()) {
    e.year = 'Введите учебный год, например 2026–2027.';
  } else {
    const m = d.year.match(YEAR_RE);
    if (!m) e.year = 'Формат учебного года: 2026–2027.';
    else if (Number(m[2]) !== Number(m[1]) + 1) e.year = 'Второй год должен быть на 1 больше первого.';
  }
  return e;
}

function fileName(d, ext) {
  const base = `Обложка_${d.fullName}_${d.className}`
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120);
  return `${base}.${ext}`;
}

const sameData = (a, b) => a.fullName === b.fullName && a.className === b.className && a.year === b.year;

export default function App() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [fatal, setFatal] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'ok' | 'error', text }
  const [result, setResult] = useState(null); // { data, png, docx }
  const previewRef = useRef(null);
  const nameRef = useRef(null);

  const normalized = useMemo(() => normalize(form), [form]);
  const isStale = result !== null && !sameData(result.data, normalized);
  const canDownload = result !== null && !isStale && !busy;

  // Предпросмотр в реальном времени
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    let cancelled = false;
    const t = setTimeout(() => {
      renderCover(canvas, normalized, 1)
        .then(() => !cancelled && setFatal(null))
        .catch((err) => !cancelled && setFatal(err.message));
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [normalized]);

  // Уведомление исчезает через 6 секунд
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const onChange = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const generate = useCallback(async () => {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setToast({ type: 'error', text: 'Заполните обязательные поля, отмеченные красным.' });
      return;
    }
    setBusy(true);
    try {
      const data = normalize(form);
      const canvas = document.createElement('canvas');
      await renderCover(canvas, data, EXPORT_SCALE); // 2174 × 3072
      const png = await canvasToPngBlob(canvas);
      const docx = await buildDocx(png);
      setResult({ data, png, docx });
      setToast({ type: 'ok', text: `Готово! Обложка для ${data.fullName} создана` });
    } catch (err) {
      setToast({ type: 'error', text: `Ошибка генерации: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }, [form]);

  const clear = () => {
    setForm(EMPTY);
    setErrors({});
    setResult(null);
    setToast(null);
    nameRef.current?.focus();
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo" aria-hidden="true">№21</div>
        <div>
          <h1>Генератор обложек школы №21</h1>
          <p>Оригинальный шаблон «Окуучунун иши» — меняются только данные ученика</p>
        </div>
      </header>

      <main className="layout">
        <section className="card form-card" aria-label="Данные ученика">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <Field
              id="fullName"
              label="ФИО ученика"
              value={form.fullName}
              onChange={onChange('fullName')}
              error={errors.fullName}
              placeholder="Абдрахманов Азамат Исламович"
              inputRef={nameRef}
              maxLength={90}
              autoComplete="name"
            />
            <div className="row">
              <Field
                id="className"
                label="Класс"
                value={form.className}
                onChange={onChange('className')}
                error={errors.className}
                placeholder="9-А"
                maxLength={20}
              />
              <Field
                id="year"
                label="Учебный год"
                value={form.year}
                onChange={onChange('year')}
                error={errors.year}
                placeholder="2026–2027"
                maxLength={15}
                inputMode="numeric"
              />
            </div>

            <div className="field">
              <span className="label">Школа</span>
              <div className="school" aria-readonly="true">
                <span>{SCHOOL}</span>
                <span className="badge">на шаблоне</span>
              </div>
              <span className="hint">Уже напечатана на оригинальной обложке</span>
            </div>

            <div className="actions">
              <button type="submit" className="btn btn-primary" disabled={busy || !!fatal}>
                {busy ? 'Создание…' : 'Сгенерировать обложку'}
              </button>
              <div className="actions-row">
                <button
                  type="button"
                  className="btn"
                  disabled={!canDownload}
                  onClick={() => saveAs(result.png, fileName(result.data, 'png'))}
                >
                  Скачать PNG
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!canDownload}
                  onClick={() => saveAs(result.docx, fileName(result.data, 'docx'))}
                >
                  Скачать Word
                </button>
              </div>
              <button type="button" className="btn btn-ghost" onClick={clear} disabled={busy}>
                Очистить поля
              </button>
            </div>

            <div className="status" aria-live="polite">
              {fatal && <p className="msg msg-error">{fatal}</p>}
              {isStale && (
                <p className="msg msg-warn">Данные изменены — нажмите «Сгенерировать обложку», чтобы обновить файлы.</p>
              )}
              {!result && !fatal && (
                <p className="meta">Кнопки скачивания станут активны после генерации.</p>
              )}
              {canDownload && (
                <p className="meta">
                  PNG 2174 × 3072 px · {(result.png.size / 1048576).toFixed(1)} МБ · Word: A4, 1 страница, без полей
                </p>
              )}
            </div>
          </form>
        </section>

        <section className="card preview-card" aria-label="Предварительный просмотр">
          <div className="preview-head">
            <span>Предпросмотр</span>
            <span className="badge">A4 · книжная</span>
          </div>
          <div className="sheet">
            <canvas ref={previewRef} className="preview" />
          </div>
        </section>
      </main>

      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          <span className="toast-icon" aria-hidden="true">{toast.type === 'ok' ? '✓' : '!'}</span>
          <span>{toast.text}</span>
          <button className="toast-close" onClick={() => setToast(null)} aria-label="Закрыть">×</button>
        </div>
      )}
    </div>
  );
}

function Field({ id, label, error, inputRef, ...rest }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id} className="label">
        {label} <span className="req">*</span>
      </label>
      <input
        id={id}
        name={id}
        ref={inputRef}
        required
        spellCheck={false}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        {...rest}
      />
      {error && (
        <span id={`${id}-err`} className="err">
          {error}
        </span>
      )}
    </div>
  );
}
