// Статусы на основе ИИ-анализа звонка

export interface AiData {
  outcome?: string;       // success | failure | pending
  call_type?: string;     // target | non_target
  qualification?: boolean;
  client_interest?: string; // high | medium | low
}

export interface CallAiStatus {
  label: string;
  color: string;
  bg: string;
  icon: string;
  priority: number; // для сортировки
}

/**
 * Определяет статус звонка на основе ИИ-анализа.
 * Логика приоритетов (от важного к менее важному):
 * 1. Квалифицирован (ЛПР + интерес) — самый ценный
 * 2. Целевой в работе — есть потенциал
 * 3. Успех — сделка/договорённость
 * 4. Высокий интерес — перспективный
 * 5. Средний интерес — нейтральный
 * 6. Отказ нецелевой — потеря времени
 * 7. Отказ целевой — работа с возражениями
 * 8. Нецелевой — спам/ошибочный
 */
export function getAiStatus(ai?: AiData): CallAiStatus | null {
  if (!ai) return null;

  const { outcome, call_type, qualification, client_interest } = ai;

  // Квалифицирован — ЛПР выявлен, есть потребность
  if (qualification) {
    return {
      label: 'Квалифицирован',
      color: '#00ffaa',
      bg:    'rgba(0,255,170,0.12)',
      icon:  'UserCheck',
      priority: 1,
    };
  }

  // Успех — договорились о следующем шаге
  if (outcome === 'success') {
    return {
      label: 'Успех',
      color: 'var(--brand-green)',
      bg:    'rgba(0,255,136,0.12)',
      icon:  'CheckCircle',
      priority: 2,
    };
  }

  // Целевой, в работе, высокий интерес → перспективный
  if (call_type === 'target' && outcome === 'pending' && client_interest === 'high') {
    return {
      label: 'Перспективный',
      color: '#00aaff',
      bg:    'rgba(0,170,255,0.12)',
      icon:  'Star',
      priority: 3,
    };
  }

  // Целевой в работе
  if (call_type === 'target' && outcome === 'pending') {
    return {
      label: 'В работе',
      color: '#00aaff',
      bg:    'rgba(0,170,255,0.1)',
      icon:  'Clock',
      priority: 4,
    };
  }

  // Целевой но отказ — работа с возражениями
  if (call_type === 'target' && outcome === 'failure') {
    return {
      label: 'Отказ (целевой)',
      color: '#ff8c00',
      bg:    'rgba(255,140,0,0.1)',
      icon:  'XCircle',
      priority: 5,
    };
  }

  // Нецелевой — не наша аудитория
  if (call_type === 'non_target') {
    return {
      label: 'Нецелевой',
      color: 'var(--text-muted)',
      bg:    'rgba(255,255,255,0.05)',
      icon:  'MinusCircle',
      priority: 7,
    };
  }

  // Отказ без уточнения типа
  if (outcome === 'failure') {
    return {
      label: 'Отказ',
      color: '#ff4444',
      bg:    'rgba(255,68,68,0.1)',
      icon:  'XCircle',
      priority: 6,
    };
  }

  return null;
}
