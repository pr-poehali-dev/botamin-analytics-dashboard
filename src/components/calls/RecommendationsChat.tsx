import { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/icon';

const CHAT_URL = 'https://functions.poehali.dev/2e498fb3-3b26-4242-9865-1faa4c3f5f49';

const DEFAULT_PROMPT = `Ты жёсткий бизнес-советник по продажам B2B. Твоя задача — разбирать рекомендации по звонкам вместе с руководителем и помогать принимать верные решения.

ПРАВИЛА ПОВЕДЕНИЯ:
1. НЕ ЛЬСТИ. Если данные говорят одно, а руководитель думает другое — скажи прямо, что он ошибается.
2. СПОРЬ когда есть основания. Если возражение руководителя не подкреплено данными — объясни почему ты остаёшься при своём.
3. МЕНЯЙ позицию только под влиянием фактов и логики, не под давлением.
4. ПРЕДЛАГАЙ конкретные действия: что сделать сегодня, что завтра, что измерить через неделю.
5. ПРЕДЛАГАЙ экстремальные решения если ситуация того требует: уволить оператора, сменить базу полностью, остановить кампанию, поднять цену.
6. ГОВОРИ цифрами: не "улучшить конверсию", а "поднять с 2.3% до 5% за 30 дней".
7. Если руководитель говорит "мы уже пробовали" — спроси что именно и почему не сработало.
8. ЗАДАВАЙ встречные вопросы чтобы понять контекст бизнеса.
9. Ссылайся на конкретные рекомендации из списка по их номеру (#1, #2 и т.д.).
10. Отвечай коротко и по делу — не более 5–7 предложений если не нужно больше.`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiRec {
  id: string;
  priority: string;
  category: string;
  title: string;
  problem: string;
  action: string;
  metric: string;
  target: string;
}

interface Props {
  recommendations: AiRec[];
}

export default function RecommendationsChat({ recommendations }: Props) {
  const [tab, setTab]           = useState<'chat' | 'prompt'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [prompt, setPrompt]     = useState(DEFAULT_PROMPT);
  const [promptSaved, setPromptSaved] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          recommendations,
          system_prompt: prompt,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Ошибка соединения. Попробуйте ещё раз.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const savePrompt = () => {
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  };

  const resetPrompt = () => setPrompt(DEFAULT_PROMPT);

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', height: 600 }}>

      {/* Шапка с вкладками */}
      <div className="flex items-center gap-0 border-b shrink-0"
        style={{ borderColor: 'var(--border-default)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-r"
          style={{ borderColor: 'var(--border-default)' }}>
          <Icon name="MessageSquare" size={14} style={{ color: 'var(--brand-green)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Советник по рекомендациям
          </span>
        </div>
        <div className="flex items-center">
          {([
            { id: 'chat' as const,   label: 'Чат',    icon: 'MessageCircle' },
            { id: 'prompt' as const, label: 'Промпт', icon: 'Settings2' },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-all border-b-2"
              style={{
                borderColor: tab === t.id ? 'var(--brand-green)' : 'transparent',
                color: tab === t.id ? 'var(--brand-green)' : 'var(--text-muted)',
              }}>
              <Icon name={t.icon} size={12} />
              {t.label}
            </button>
          ))}
        </div>
        {messages.length > 0 && tab === 'chat' && (
          <button
            onClick={() => setMessages([])}
            className="ml-auto mr-3 flex items-center gap-1 px-2 py-1 rounded text-xs opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-muted)' }}>
            <Icon name="Trash2" size={11} />
            Очистить
          </button>
        )}
      </div>

      {/* ── ЧАТ ── */}
      {tab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(0,255,136,0.1)' }}>
                  <Icon name="Bot" size={22} style={{ color: 'var(--brand-green)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    Жёсткий советник готов
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)', maxWidth: 280 }}>
                    Обсудите любую рекомендацию — объясните контекст, поспорьте, добавьте детали. ИИ не будет льстить.
                  </p>
                </div>
                <div className="flex flex-col gap-2 mt-2 w-full max-w-xs">
                  {[
                    'Почему конверсия 2.3% — это не так плохо?',
                    'Я не согласен с рекомендацией #1, объясни',
                    'Что сделать прямо сегодня?',
                  ].map(q => (
                    <button key={q} onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                      className="text-left px-3 py-2 rounded-xl text-xs transition-all hover:opacity-80"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: m.role === 'user' ? 'var(--brand-green)' : 'rgba(255,140,0,0.15)',
                  }}>
                  <Icon
                    name={m.role === 'user' ? 'User' : 'Bot'}
                    size={13}
                    style={{ color: m.role === 'user' ? '#000' : '#ff8c00' }}
                  />
                </div>
                <div className="flex-1 max-w-[85%]">
                  <div
                    className="px-3 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap"
                    style={{
                      background: m.role === 'user' ? 'rgba(0,255,136,0.1)' : 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid',
                      borderColor: m.role === 'user' ? 'rgba(0,255,136,0.2)' : 'var(--border-default)',
                      borderRadius: m.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    }}>
                    {m.content}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,140,0,0.15)' }}>
                  <Icon name="Bot" size={13} style={{ color: '#ff8c00' }} />
                </div>
                <div className="px-4 py-3 rounded-2xl flex items-center gap-1.5"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '4px 16px 16px 16px' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: '#ff8c00', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Поле ввода */}
          <div className="px-4 pb-4 pt-2 shrink-0 border-t"
            style={{ borderColor: 'var(--border-default)' }}>
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Напишите сообщение… (Enter — отправить, Shift+Enter — перенос)"
                rows={2}
                className="flex-1 resize-none rounded-xl px-3 py-2.5 text-xs outline-none transition-all"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  lineHeight: '1.5',
                }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all shrink-0 disabled:opacity-40"
                style={{ background: 'var(--brand-green)' }}>
                <Icon name="Send" size={15} style={{ color: '#000' }} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── ПРОМПТ ── */}
      {tab === 'prompt' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-2 shrink-0">
            <div className="flex items-start gap-2 p-3 rounded-xl mb-3"
              style={{ background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.2)' }}>
              <Icon name="AlertTriangle" size={13} style={{ color: '#ff8c00', marginTop: 1 }} />
              <p className="text-xs leading-relaxed" style={{ color: '#ff8c00' }}>
                Здесь вы управляете характером ИИ-советника. Чем чётче инструкция — тем полезнее ответы. Изменения применяются к следующему сообщению в чате.
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-hidden px-4 pb-2">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="w-full h-full resize-none rounded-xl px-3 py-3 text-xs outline-none font-mono leading-relaxed"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div className="flex gap-2 px-4 pb-4 shrink-0">
            <button
              onClick={resetPrompt}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all hover:opacity-80"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
              <Icon name="RotateCcw" size={12} />
              Сбросить
            </button>
            <button
              onClick={savePrompt}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all"
              style={{ background: promptSaved ? 'rgba(0,255,136,0.2)' : 'var(--brand-green)', color: promptSaved ? 'var(--brand-green)' : '#000' }}>
              <Icon name={promptSaved ? 'Check' : 'Save'} size={12} />
              {promptSaved ? 'Сохранено' : 'Применить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
