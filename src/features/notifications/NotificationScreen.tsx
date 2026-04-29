import { ArrowLeft, Settings, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { NotificationCategory } from '../../entities/notification/types';
import { NOTIFICATION_FILTERS, NOTIFICATION_ITEMS } from '../../mocks/notifications';
import BottomSheet from '../../app/components/overlay/BottomSheet';

interface NotificationScreenProps {
  onClose: () => void;
}

export default function NotificationScreen({ onClose }: NotificationScreenProps) {
  const [activeFilter, setActiveFilter] = useState<NotificationCategory>('all');

  const filteredNotifications = activeFilter === 'all' ? NOTIFICATION_ITEMS : NOTIFICATION_ITEMS.filter((notification) => notification.category === activeFilter);

  return (
    <BottomSheet
      onClose={onClose}
      maxHeightClassName="max-h-[680px]"
      panelClassName="animate-slideUp"
      headerLeft={
        <button onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-neutral-700" />
        </button>
      }
      headerRight={
        <button className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors">
          <Settings className="w-5 h-5 text-neutral-500" />
        </button>
      }
      title={<span className="text-[20px] font-bold">알림 센터</span>}
      bodyClassName="p-0"
    >
          {/* Filter Bar */}
          <div className="px-5 py-4 border-b border-neutral-100">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {NOTIFICATION_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.value)}
                    className={`min-h-11 px-4 py-2 rounded-full text-[15px] font-medium whitespace-nowrap transition-all ${
                    activeFilter === filter.value
                      ? 'bg-blue-50 text-blue-600 border-2 border-blue-500'
                      : 'bg-white text-neutral-500 border-2 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-3">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-12 text-neutral-400">
                  <p>알림이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-colors min-h-[84px] ${
                        !notification.isRead 
                          ? 'bg-blue-50/50 hover:bg-blue-50' 
                          : 'hover:bg-neutral-50'
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`${notification.gymColor} w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-[15px] font-bold">{notification.gymInitials}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[15px] leading-6 mb-1 ${
                          !notification.isRead 
                            ? 'font-bold text-neutral-900' 
                            : 'font-medium text-neutral-700'
                        }`}>
                          {notification.message}
                        </p>
                        <p className="text-[13px] text-neutral-400">{notification.timestamp}</p>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="w-5 h-5 text-neutral-300 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
    </BottomSheet>
  );
}
