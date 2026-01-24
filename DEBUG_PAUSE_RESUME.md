# 🐛 Отладка проблемы с кнопкой Resume после Pause

## Проблема
После нажатия кнопки Pause на торренте, кнопка Resume не появляется.

## Добавленное логирование

Я добавил отладочные логи в ключевые места для диагностики проблемы:

### 1. В компоненте DownloadItem
```typescript
console.log(`[DownloadItem] ${download.name}:`, {
  status,
  downloadStatus: download.status,
  hasStats: !!stats,
  statsStatus: stats?.status,
  canPause: canPause(status),
  canResume: canResume(status),
});
```

Это покажет:
- Какой статус используется для отображения
- Есть ли статистика от сервера
- Результаты проверок canPause() и canResume()

### 2. В handlePause
```typescript
console.log('[handlePause] Pausing download:', id);
console.log('[handlePause] API call successful, reloading downloads');
console.log('[handlePause] Downloads reloaded');
```

Отслеживает процесс паузы.

### 3. В onDownloadStats subscriber
```typescript
console.log('[onDownloadStats] Received stats:', ...);
console.log(`[onDownloadStats] Status changed for ${d.name}: ${d.status} -> ${stat.status}`);
```

Показывает, когда и как обновляется статус от сервера.

### 4. В loadDownloads
```typescript
console.log('[loadDownloads] Loaded downloads:', list.map(d => ({ name: d.name, status: d.status })));
```

Показывает данные, загруженные из БД.

## Как протестировать

1. **Запустите приложение в dev режиме:**
   ```bash
   cd "C:\Users\Nihil Obscurum\WebstormProjects\untitled\TorrentHunt"
   npm run dev
   ```

2. **Откройте DevTools** (F12 или Ctrl+Shift+I)

3. **Добавьте торрент** (любой magnet link или .torrent файл)

4. **Дождитесь начала загрузки** (статус: `downloading`)

5. **Нажмите кнопку Pause** (⏸️)

6. **Смотрите в консоль:**

   Ожидаемый вывод:
   ```
   [handlePause] Pausing download: <id>
   [handlePause] API call successful, reloading downloads
   [loadDownloads] Loaded downloads: [{ name: "...", status: "paused" }]
   [handlePause] Downloads reloaded
   [onDownloadStats] Received stats: [{ id: "...", status: "paused" }]
   [onDownloadStats] Status changed for ...: downloading -> paused
   [DownloadItem] ...: {
     status: "paused",
     canPause: false,
     canResume: true  ← ДОЛЖНО БЫТЬ TRUE!
   }
   ```

## Возможные причины проблемы

### Гипотеза 1: Статус не обновляется в БД
**Проверка:** Смотрим `[loadDownloads]` лог  
**Если status != "paused"**: проблема в торрент-менеджере (не вызывает `transitionStatus`)

### Гипотеза 2: Статус не приходит в stats
**Проверка:** Смотрим `[onDownloadStats]` лог  
**Если нет обновления**: проблема в `getStats()` - не включает остановленные торренты

### Гипотеза 3: Статус не применяется к компоненту
**Проверка:** Смотрим `[DownloadItem]` лог  
**Если status != "paused"**: проблема в логике слияния stats и download

### Гипотеза 4: canResume возвращает false для paused
**Проверка:** Смотрим `[DownloadItem]` лог, поле `canResume`  
**Если false**: проблема в state-machine.ts (но маловероятно, т.к. код правильный)

## Ожидаемое поведение state-machine

```typescript
// В shared/state-machine.ts
export const RESUMABLE_STATES = ['paused', 'queued', 'error'];
export const PAUSABLE_STATES = ['downloading', 'seeding', 'queued'];

export function canResume(status: DownloadStatus): boolean {
  return RESUMABLE_STATES.includes(status);
}

export function canPause(status: DownloadStatus): boolean {
  return PAUSABLE_STATES.includes(status);
}
```

Для статуса `'paused'`:
- ✅ `canResume('paused')` = **true**
- ❌ `canPause('paused')` = **false**

## Следующие шаги после тестирования

1. **Найдите в консоли**, где именно прерывается цепочка обновлений
2. **Скопируйте логи** и отправьте мне
3. **Я проанализирую** и исправлю конкретную проблему

## Для быстрой проверки state-machine

Откройте консоль браузера в DevTools и выполните:

```javascript
// Импортируйте функции (если они экспортированы в window)
// Или проверьте напрямую:
const RESUMABLE_STATES = ['paused', 'queued', 'error'];
const canResume = (status) => RESUMABLE_STATES.includes(status);

console.log('canResume("paused"):', canResume('paused'));  // Должно быть true
console.log('canResume("downloading"):', canResume('downloading'));  // Должно быть false
```

---

**После тестирования уберите логи** или я могу их удалить автоматически.
