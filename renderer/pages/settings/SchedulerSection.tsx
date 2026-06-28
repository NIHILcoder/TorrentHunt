/**
 * Settings → Scheduler section.
 *
 * Extracted verbatim from SettingsPage's renderSchedulerSettings(). The two
 * shared render helpers (renderSettingItem / renderToggle) and all scheduler
 * state + handlers are passed in as props, so behaviour is identical and no
 * other settings tab is affected. Relies on the global SettingsPage.css.
 */

import React from 'react';
import { ScheduleEntry } from '../../../shared/types';
import { Button, Icon } from '../../components';
import { useTranslation } from '../../utils/i18nContext';

interface SchedulerSectionProps {
  renderSettingItem: (
    label: string,
    description: string,
    control: React.ReactNode,
    icon?: React.ReactNode
  ) => React.ReactNode;
  renderToggle: (active: boolean, onChange: () => void) => React.ReactNode;
  schedulerEnabled: boolean;
  handleSchedulerToggle: () => void;
  schedules: ScheduleEntry[];
  dayNames: string[];
  handleAddSchedule: () => void;
  handleRemoveSchedule: (id: string) => void;
  handleUpdateSchedule: (id: string, updates: Partial<ScheduleEntry>) => void;
}

export const SchedulerSection: React.FC<SchedulerSectionProps> = ({
  renderSettingItem,
  renderToggle,
  schedulerEnabled,
  handleSchedulerToggle,
  schedules,
  dayNames,
  handleAddSchedule,
  handleRemoveSchedule,
  handleUpdateSchedule,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="settings-category-header">
        <h1 className="settings-category-title">{t('settings.scheduler')}</h1>
        <p className="settings-category-subtitle">{t('settings.sub.scheduler')}</p>
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">{t('settings.grp.scheduler')}</h3>
        {renderSettingItem(
          t('settings.schedEnable'),
          t('settings.schedEnable.desc'),
          renderToggle(schedulerEnabled, () => handleSchedulerToggle())
        )}
      </div>

      {schedulerEnabled && (
        <>
          <div className="settings-divider" />
          <div className="settings-group">
            <div className="settings-group-header">
              <h3 className="settings-group-title">{t('settings.grp.schedules')}</h3>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="plus" size={14} />}
                onClick={handleAddSchedule}
              >
                {t('settings.add')}
              </Button>
            </div>

            {schedules.length === 0 ? (
              <div className="empty-state-compact">
                <Icon name="calendar" size={24} />
                <p>{t('settings.noSchedules')}</p>
              </div>
            ) : (
              <div className="schedule-list">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="schedule-entry-compact">
                    <div className="schedule-days-compact">
                      {dayNames.map((day, idx) => (
                        <button
                          key={idx}
                          className={`day-button ${schedule.days.includes(idx) ? 'active' : ''}`}
                          onClick={() => {
                            const newDays = schedule.days.includes(idx)
                              ? schedule.days.filter((d) => d !== idx)
                              : [...schedule.days, idx].sort();
                            handleUpdateSchedule(schedule.id, { days: newDays });
                          }}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <div className="schedule-time-compact">
                      <input
                        type="time"
                        className="time-input-compact"
                        value={schedule.startTime}
                        onChange={(e) =>
                          handleUpdateSchedule(schedule.id, { startTime: e.target.value })
                        }
                      />
                      <span className="time-separator">—</span>
                      <input
                        type="time"
                        className="time-input-compact"
                        value={schedule.endTime}
                        onChange={(e) =>
                          handleUpdateSchedule(schedule.id, { endTime: e.target.value })
                        }
                      />
                    </div>
                    <button
                      className="button-icon-compact"
                      onClick={() => handleRemoveSchedule(schedule.id)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};
