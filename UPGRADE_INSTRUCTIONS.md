# Downloads Page - Документация

## 📋 Содержание

- [Обзор](#обзор)
- [Реализованный функционал](#реализованный-функционал)
- [Архитектура](#архитектура)
- [Компоненты](#компоненты)
- [API и типы данных](#api-и-типы-данных)
- [Предложенные улучшения](#предложенные-улучшения)характеристики затухающих колебаний
- [Технические детали](#технические-детали)

---

## Обзор

Downloads Page — главный экран приложения TorrentHunt для управления загрузками торрентов. Предоставляет полный набор инструментов для контроля, фильтрации, сортировки и взаимодействия с активными и завершёнными загрузками.

Местоположение: renderer/pages/DownloadsPage.tsx

Стили: renderer/pages/DownloadsPage.css

---

## Реализованный функционал

### ✅ Основные функции

#### 1. Управление загрузками
| Функция | Описание | Статус |
|---------|---------|--------|
| Добавление торрента | Поддержка файлов и магнет-ссылок | ✅ Реализовано |
| Pause/Resume | Приостановка и возобновление загрузок | ✅ Реализовано |
| Удаление | С опцией удаления файлов или сохранения | ✅ Реализовано |
| Retry | Повторная попытка при ошибке | ✅ Реализовано |
| Stop Seeding | Остановка раздачи после завершения | ✅ Реализовано |

#### 2. Отображение и навигация
| Функция | Описание | Статус |
|---------|---------|--------|
| Режим Compact | Компактное отображение в одну строку | ✅ Реализовано |
| Режим Detailed | Развёрнутое отображение со статистикой | ✅ Реализовано |
| Переключение режимов | Кнопки для быстрого переключения | ✅ Реализовано |
| Drag & Drop | Добавление торрентов перетаскиванием | ✅ Реализовано |

#### 3. Фильтрация
| Фильтр | Описание | Статус |
|--------|---------|--------|
| All | Все загрузки | ✅ Реализовано |
| Downloading | Активно загружающиеся и в очереди | ✅ Реализовано |
| Completed | Завершённые и раздающиеся | ✅ Реализовано |
| Paused | Приостановленные загрузки | ✅ Реализовано |
| Error | Загрузки с ошибками | ✅ Реализовано |
| Поиск | Поиск по названию | ✅ Реализовано |

#### 4. Сортировка
| Режим | Описание | Статус |
|------|---------|--------|
| Date Added | По дате добавления (по умолчанию) | ✅ Реализовано |
| Name | По алфавиту | ✅ Реализовано |
| Progress | По проценту загрузки | ✅ Реализовано |
| Speed | По скорости загрузки | ✅ Реализовано |

#### 5. Множественный выбор
| Функция | Описание | Статус |
|---------|---------|--------|
| Checkboxes | Выбор отдельных загрузок | ✅ Реализовано |
| Bulk Pause | Приостановить все выбранные | ✅ Реализовано |
| Bulk Resume | Возобновить все выбранные | ✅ Реализовано |
| Bulk Remove | Удалить все выбранные | ✅ Реализовано |
| Clear Selection | Снять выделение | ✅ Реализовано |

#### 6. Статистика
| Метрика | Описание | Статус |
|---------|---------|--------|
| Global Stats | Общая статистика (Total, Active, Done) | ✅ Реализовано |
| Download Speed | Общая скорость загрузки | ✅ Реализовано |
| Upload Speed | Общая скорость раздачи | ✅ Реализовано |
| Детальные stats | Per-download статистика | ✅ Реализовано |

#### 7. Информация о загрузке

Компактный режим показывает:
- Название и иконка статуса
- Процент загрузки
- Размер файла
- Скорость (для активных)
- ETA (для активных)
- Ошибка (если есть)

Детальный режим показывает:
- Полное имя и статус
- Progress bar с процентом
- Загружено/Выгружено (байты)
- Ratio (коэффициент раздачи)
- Размер файла
- Скорость загрузки/раздачи
- ETA и количество пиров
- Путь сохранения файла

#### 8. Контроль и взаимодействие
| Функция | Описание | Статус |
|---------|---------|--------|
| Context Menu | Правый клик для быстрых действий | ✅ Реализовано |
| Open Folder | Открыть папку с файлами | ✅ Реализовано |
| Show Files | Просмотр файлов в загрузке | ✅ Реализовано |
| Toast Notifications | Всплывающие уведомления | ✅ Реализовано |
| File Preview | Просмотр списка файлов | ✅ Реализовано |

---

## Архитектура

### Структура компонента

DownloadsPage (главный компонент)
├── DownloadItem (компонент строки)
│   ├── Compact view
│   └── Detailed view
├── Global stats bar
├── Filter & Sort controls
├── Bulk actions bar
├── Drop zone overlay
├── File preview
├── Downloads list
├── File selector modal
├── Toast container
└── Context menu

### State Management

// Основные состояния
const [downloads, setDownloads] = useState<Download[]>([]);
const [stats, setStats] = useState<Map<string, DownloadStats>>(new Map());
const [loading, setLoading] = useState(true);

// UI состояния
const [viewMode, setViewMode] = useState<ViewMode>('detailed');
const [filterMode, setFilterMode] = useState<FilterMode>('all');
const [sortMode, setSortMode] = useState<SortMode>('added');
const [searchQuery, setSearchQuery] = useState('');

// Selection и контекст
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [contextMenu, setContextMenu] = useState<{ x, y, downloadId } | null>(null);

// Drag & Drop
const [isDragging, setIsDragging] = useState(false);
const [selectedFile, setSelectedFile] = useState<File | null>(null);

// Модальные окна
const [previewId, setPreviewId] = useState<string | null>(null);
const [showFileSelector, setShowFileSelector] = useState(false);
const [pendingTorrent, setPendingTorrent] = useState<{ path?, magnetUri? } | null>(null);

// Уведомления
const [toasts, setToasts] = useState<Toast[]>([]);

### Data Flow

API (window.api) → Downloads Data
                ↓
        Component State
                ↓
        Filtering & Sorting
                ↓
        Rendering Lists
                ↓
    User Actions → API Calls → State Updates

---

## Компоненты

### DownloadItem

Props:
interface DownloadItemProps {
  download: Download;
  stats: DownloadStats | undefined;
  viewMode: ViewMode;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string, deleteFiles: boolean) => void;
  onStopSeeding: (id: string) => void;
  onRetry: (id: string) => void;
  onOpenFolder: (path: string) => void;
  onShowFiles: (id: string) => void;
}

Функции:
- Условное отображение Compact/Detailed
- Динамические иконки действий на основе статуса
- Подтверждение удаления с опциями
- Форматирование байтов, скорости, ETA

### Используемые компоненты

| Компонент | Источник | Использование |
|-----------|----------|----------------|
| Button | components/Button.tsx | Все кнопки действий |
| Icon | components/Icon.tsx | Иконки статусов и действий |
| Input | components/Input.tsx | Поле поиска |
| ProgressBar | components/ProgressBar.tsx | Прогресс-бары |
| StatusBadge | components/Badge.tsx | Статусы загрузок |
| Toast | components/Toast.tsx | Уведомления |
| EmptyState | components/EmptyState.tsx | Пустые состояния |
| FilePreview | components/FilePreview.tsx | Просмотр файлов |
| ContextMenu | components/ContextMenu.tsx | Контекстное меню |
| TorrentFileSelector | components/TorrentFileSelector.tsx | Выбор файлов из торрента |

---

## API и типы данных

### Download Interface

export interface Download {
  id: string;                    // Уникальный ID
  name: string;                  // Название торрента
  sourceType: SourceType;        // 'magnet' | 'torrent_file' | 'catalog'
  sourceUri: string;             // Магнет-ссылка или путь к файлу
  torrentFilePath: string | null; // Путь к .torrent файлу
  savePath: string;              // Папка сохранения
  status: DownloadStatus;        // Текущий статус
  progress: number;              // 0-1 (процент)
  downloadedBytes: number;       // Загружено байт
  uploadedBytes: number;         // Выгружено байт
  downSpeedBps: number;          // Скорость загрузки
  upSpeedBps: number;            // Скорость раздачи
  etaSeconds: number | null;     // Оставшееся время
  peers: number;                 // Количество пиров
  seeds: number;                 // Количество сидеров
  totalSize: number;             // Общий размер в байтах
  priority: number;              // 0=low, 1=normal, 2=high
  createdAt: Date;               // Время добавления
  updatedAt: Date;               // Время обновления
  lastError: string | null;      // Последняя ошибка
}

### DownloadStatus

type DownloadStatus = 
  | 'queued'       // В очереди
  | 'downloading'  // Загружается
  | 'paused'       // Приостановлена
  | 'completed'    // Завершена
  | 'seeding'      // Раздается
  | 'error'        // Ошибка
  | 'removed';     // Удалена

### DownloadStats Interface

export interface DownloadStats {
  id: string;
  progress: number;
  downloadedBytes: number;
  uploadedBytes: number;
  downSpeedBps: number;
  upSpeedBps: number;
  etaSeconds: number | null;
  peers: number;
  seeds: number;
  status: DownloadStatus;
}

### API Methods

// Получить все загрузки
getDownloads(): Promise<Download[]>

// Добавить загрузку
addDownload(request: AddDownloadRequest): Promise<Download>

// Управление
pauseDownload(id: string): Promise<void>
resumeDownload(id: string): Promise<void>
removeDownload(id: string, deleteFiles: boolean): Promise<void>
stopSeeding(id: string): Promise<void>
retryDownload(id: string): Promise<void>

// Утилиты
selectTorrentFile(): Promise<{ path: string }>
openPath(path: string): Promise<void>

// Listeners
onDownloadStats(callback: (stats: DownloadStats[]) => void): () => void

---

## Предложенные улучшения

### 🎯 Приоритет 1: Критический функционал

#### 1.1 Приоритизация загрузок

Описание: Возможность установки приоритета для каждой загрузки (Low/Normal/High).

Реализация:
- Добавить UI для выбора приоритета (dropdown или radio buttons)
- Использовать поле download.priority (уже в типах)
- Показывать иконку приоритета в списке
- Интегрировать с бэкендом для реального эффекта

Файлы:
- renderer/pages/DownloadsPage.tsx - добавить UI
- renderer/pages/DownloadsPage.css - стили приоритета
- API: setPriority(id: string, priority: number)

Примерный код:
const handleSetPriority = async (id: string, priority: number) => {
  try {
    await window.api.setPriority(id, priority);
    addToast('Priority updated', 'success');
  } catch (error) {
    addToast(`Failed: ${error.message}`, 'error');
  }
};

---

#### 1.2 Ограничение скорости (Rate Limiting)

Описание: Установка максимальной скорости загрузки/раздачи для конкретной загрузки.

Реализация:
- Input поля для ввода скорости (KB/s)
- Кнопка для применения лимита
- Отображение текущего лимита
- Per-download и global лимиты

Файлы:
- renderer/pages/DownloadsPage.tsx - UI для лимитов
- API методы: setDownloadLimit(), setUploadLimit()

Примерный код:
const handleSetSpeedLimit = async (id: string, limitKbps: number) => {
  try {
    await window.api.setDownloadLimit(id, limitKbps * 1024);
    addToast(`Limit set to ${limitKbps} KB/s`, 'success');
  } catch (error) {
    addToast(`Failed: ${error.message}`, 'error');
  }
};

---

#### 1.3 Планировщик загрузок (Scheduler)

Описание: Опция запланировать начало/остановку загрузок на определённое время.

Реализация:
- Модальное окно с выбором времени
- Options: Start at, Stop at, Run only between hours
- Persistent storage в БД
- Background task для выполнения

Файлы:
- Новый компонент: renderer/components/ScheduleDialog.tsx
- renderer/pages/DownloadsPage.tsx - кнопка "Schedule"
- API: scheduleDownload(), getSchedule()

Примерный код:
interface Schedule {
  id: string;
  downloadId: string;
  startTime?: string; // HH:MM
  stopTime?: string;
  daysOfWeek?: number[]; // 0-6
}

const handleOpenScheduler = (downloadId: string) => {
  setSchedulerOpen(true);
  setSchedulerTarget(downloadId);
};

---

### 🎨 Приоритет 2: Улучшения UX

#### 2.1 Горячие клавиши (Keyboard Shortcuts)

Реализация:
- Delete - удалить выбранные
- Ctrl+A - выбрать все
- Ctrl+F - поиск
- Space - пауза/возобновление
- Ctrl+P - переключение режима отображения

Файлы:
- renderer/pages/DownloadsPage.tsx - добавить useEffect с keydown listener

Примерный код:
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      const allIds = new Set(downloads.map(d => d.id));
      setSelectedIds(allIds);
    }
    if (e.key === 'Delete' && selectedIds.size > 0) {
      // Удалить выбранные
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedIds, downloads]);

---

#### 2.2 Сортировка по клику на заголовок

Реализация:
- Кликабельные заголовки колонок
- Индикатор направления сортировки (↑/↓)
- Запоминание последней сортировки

Файлы:
- renderer/pages/DownloadsPage.tsx - обновить header
- renderer/pages/DownloadsPage.css - стили кликабельных заголовков

---

#### 2.3 Перетаскивание для изменения порядка (Drag to Reorder)

Реализация:
- Drag-handle на каждой строке
- Изменение порядка в UI
- Сохранение порядка на бэкенде
- Автосохранение

Библиотека: react-beautiful-dnd или встроенное решение

---

### 📊 Приоритет 3: Продвинутые функции

#### 3.1 График скорости (Speed Chart)

Описание: Историческое отображение скорости загрузки в виде линейного графика.

Реализация:
- Сбор данных скорости каждые N секунд
- Хранение последних 60 точек данных
- Отображение в детальном режиме
- Canvas или SVG для рендера

Библиотека: recharts или chart.js

Файлы:
- Новый компонент: renderer/components/SpeedChart.tsx
- renderer/pages/DownloadsPage.tsx - интеграция
- renderer/pages/DownloadsPage.css - стили

Примерный код:
const [speedHistory, setSpeedHistory] = useState<Array<{
  timestamp: number;
  downSpeed: number;
  upSpeed: number;
}>>([]); // Последние 60 точек

useEffect(() => {
  const interval = setInterval(() => {
    setSpeedHistory(prev => [
      ...prev.slice(-59),
      {
        timestamp: Date.now(),
        downSpeed: currentStats.downSpeedBps,
        upSpeed: currentStats.upSpeedBps,
      }
    ]);
  }, 1000);
  
  return () => clearInterval(interval);
}, [currentStats]);

---

#### 3.2 Категории и теги

Описание: Группировка загрузок по категориям (Video, Software, Documents и т.д.).

Реализация:
- Поле category в Download интерфейсе
- Фильтр по категориям
- Автоопределение категории по типу файла
- Возможность ручного изменения

Файлы:
- shared/types.ts - добавить category поле
- renderer/pages/DownloadsPage.tsx - UI для категорий

---

#### 3.3 Метаинформация из торрента

Описание: Отображение дополнительной информации из метаданных торрента.

Информация:
- Дата создания торрента
- Комментарии (comment field)
- Создатель (created by)
- Encoding информация

Реализация:
- Обновить TorrentInfo интерфейс
- Добавить поля в Download
- Показывать в детальном режиме
- Модальное окно с полной информацией

---

### 🔧 Приоритет 4: Интеграции и экспорт

#### 4.1 Экспорт списка загрузок

Описание: Сохранение списка загрузок в JSON или CSV.

Формат JSON:
{
  "exported_at": "2025-12-23T10:30:00Z",
  "downloads": [
    {
      "name": "Example",
      "status": "completed",
      "size": 1024000,
      "progress": 1.0,
      "magnetUri": "magnet:?xt=...",
      "savePath": "/downloads/example"
    }
  ]
}

Реализация:
- Кнопка "Export" в header
- Выбор формата (JSON/CSV)
- Фильтр: все или только завершённые
- Скачивание файла

Файлы:
- renderer/pages/DownloadsPage.tsx - добавить export функцию

Примерный код:
const handleExport = (format: 'json' | 'csv') => {
  const data = downloads.map(d => ({
    name: d.name,
    status: d.status,
    size: d.totalSize,
    progress: d.progress,
    magnetUri: d.sourceUri,
  }));
  
  if (format === 'json') {
    const json = JSON.stringify({ exported_at: new Date(), downloads: data }, null, 2);
    downloadFile(json, 'downloads.json', 'application/json');
  } else {
    const csv = convertToCSV(data);
    downloadFile(csv, 'downloads.csv', 'text/csv');
  }
};

---

#### 4.2 Импорт списка торрентов

Описание: Загрузка списка торрентов из JSON файла для массовой загрузки.

Реализация:
- Input для загрузки JSON
- Валидация формата
- Предпросмотр (что будет добавлено)
- Batch добавление с прогрессом

---

#### 4.3 Синхронизация с внешними сервисами

Описание: Интеграция с сервисами вроде Sonarr/Radarr для автоматической загрузки.

Требуется: API ключ и endpoint конфигурация

---

### 📈 Приоритет 5: Аналитика

#### 5.1 Статистика сессии

Показатели:
- Всего загружено за сессию (GB)
- Время загрузок
- Средняя скорость
- Количество завершённых
- Ratio за сессию

Хранение:
- В памяти за текущую сессию
- В localStorage для исторических данных

---

#### 5.2 История загрузок

Реализация:
- Список удалённых и завершённых загрузок
- Статистика по каждой
- Возможность восстановления
- Фильтр по датам

---

## Технические детали

### Утилиты и вспомогательные функции

// Форматирование
const formatBytes = (bytes: number): string
const formatSpeed = (bytesPerSecond: number): string
const formatEta = (seconds: number | null): string
const formatDate = (dateInput: string | Date): string

// Фильтрация
const filteredDownloads = downloads.filter(download => {...})

// Сортировка
const sortedDownloads = [...filteredDownloads].sort((a, b) => {...})

// Глобальная статистика
const globalStats = {
  total: number,
  active: number,
  completed: number,
  totalDownSpeed: number,
  totalUpSpeed: number,
}

### CSS классы

/* Контейнеры */
.page-container
.page-header
.page-content

/* Списки */
.downloads-list
.downloads-list-compact
.downloads-list-detailed
.download-item
.download-item-compact
.download-item-detailed

/* Управление */
.filter-sort-controls-compact
.bulk-actions-bar
.view-mode-toggle

/* Состояния */
.drop-zone
.drop-zone-active
.file-preview

/* Статистика */
.global-stats
.global-stat-item
.download-detailed-stats
.stat-item

### Event Handlers

| Handler | Триггер | Действие |
|---------|---------|---------|
| handleAddTorrentFile | Нажатие "Add Torrent" | Открыть dialog выбора файла |
| handleDragEnter/Over/Leave/Drop | Drag & Drop операции | Управление drop zone |
| handlePause/Resume/Remove | Кнопки действий | API вызовы |
| handleContextMenu | Правый клик | Показать context menu |
| handleSelectItem | Checkbox | Управление selection |
| handleFilterChange | Dropdown фильтра | Обновить список |
| handleSortChange | Dropdown сортировки | Переупорядочить список |

### Performance Considerations

1. Virtualization - для больших списков (500+ загрузок)
   - Использовать react-window для рендера только видимых строк
   
2. Memoization - оптимизация перерендеров
   - React.memo() для DownloadItem
   - useCallback() для обработчиков
   - useMemo() для отфильтрованных списков

3. Debouncing - для поиска и сортировки
      const debouncedSearch = debounce((query) => {
     setSearchQuery(query);
   }, 300);
   

4. Lazy Loading - подгрузка данных
   - Infinite scroll для больших списков
   - Pagination с limit/offset

---

## Файловая структура для реализации

renderer/
├── pages/
│   ├── DownloadsPage.tsx          (основной компонент)
│   ├── DownloadsPage.css          (стили)
│   └── components/
│       ├── ScheduleDialog.tsx      (новый - планировщик)
│       └── SpeedChart.tsx          (новый - график)
├── components/
│   ├── (существующие компоненты)
│   └── PrioritySelector.tsx        (новый - выбор приоритета)
├── hooks/
│   ├── useKeyboardShortcuts.ts     (новый - горячие клавиши)
│   ├── useLocalStorage.ts          (новый - сохранение)
│   └── useExport.ts                (новый - экспорт)
└── utils/
    ├── download.ts                 (утилиты загрузок)
    ├── format.ts                   (форматирование)
    └── keyboard.ts                 (горячие клавиши)

shared/
├── types.ts                         (обновить интерфейсы)
└── constants.ts                     (опционально - константы приоритетов)

---

## Дорожная карта реализации

### Этап 1 (1-2 дня)
- [ ] Приоритизация загрузок
- [ ] Горячие клавиши
- [ ] Сортировка по клику

### Этап 2 (2-3 дня)
- [ ] Ограничение скорости
- [ ] Перетаскивание для переупорядочивания
- [ ] Экспорт списка

### Этап 3 (3-5 дней)
- [ ] Планировщик загрузок
- [ ] График скорости
- [ ] Категории

### Этап 4 (5+ дней)
- [ ] История загрузок
- [ ] Аналитика сессии
- [ ] Внешние интеграции
- [ ] Оптимизация производительности

---

## Тестирование

### Unit Tests
// DownloadsPage.test.tsx
describe('DownloadsPage', () => {
  test('filters downloads correctly');
  test('sorts downloads by selected mode');
  test('handles pause/resume correctly');
  test('manages selection state');
  test('formats numbers correctly');
});

### Integration Tests
- Drag & Drop функционал
- API вызовы и обновления состояния
- Toast уведомления
- Context menu действия

### Manual Testing Checklist
- [ ] Все режимы отображения работают
- [ ] Фильтры и поиск корректны
- [ ] Сортировка правильна
- [ ] Множественный выбор функционирует
- [ ] Контекстное меню показывает правильные опции
- [ ] Drag & Drop добавляет файлы
- [ ] Toast уведомления появляются
- [ ] API вызовы выполняются успешно
- [ ] Горячие клавиши работают (после реализации)

---

## Известные ограничения

1. Performance - при 1000+ загрузок может быть lag без virtualization
2. Memory - сохранение всех загрузок в памяти (нужна пагинация)
3. Real-time - зависит от частоты обновления stats из API
4. File Selector - требует TorrentFileSelector компонент полностью
5. Context Menu - может конфликтовать с браузерным меню

---

## Ссылки на документацию

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Electron IPC](https://www.electronjs.org/docs/latest/api/ipc-main)
- [CSS Grid/Flexbox Guide](https://css-tricks.com)

---

Последнее обновление: 23 декабря 2025  
Версия: 1.0  
Статус: Полная документация + Планы развития