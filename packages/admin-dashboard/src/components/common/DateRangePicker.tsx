import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isWithinInterval, isBefore } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
  onClose: () => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  onClose,
}: DateRangePickerProps) {
  const [viewDate, setViewDate] = useState(endDate || new Date());
  const [tempStart, setTempStart] = useState<Date | null>(startDate);
  const [tempEnd, setTempEnd] = useState<Date | null>(endDate);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  // 點擊日期處理邏輯
  const handleDateClick = (date: Date) => {
    if (!tempStart || (tempStart && tempEnd)) {
      // 開始新的選擇
      setTempStart(date);
      setTempEnd(null);
    } else {
      // 已有開始日期，設定結束日期
      if (isBefore(date, tempStart)) {
        // 如果點擊的日期早於開始日期，交換
        setTempEnd(tempStart);
        setTempStart(date);
        onChange(date, tempStart);
      } else {
        setTempEnd(date);
        onChange(tempStart, date);
      }
    }
  };

  // 生成月曆天數
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  };

  // 判斷日期是否在選擇範圍內
  const isInRange = (date: Date) => {
    if (!tempStart) return false;

    const end = tempEnd || hoveredDate;
    if (!end) return false;

    const rangeStart = isBefore(tempStart, end) ? tempStart : end;
    const rangeEnd = isBefore(tempStart, end) ? end : tempStart;

    return isWithinInterval(date, { start: rangeStart, end: rangeEnd });
  };

  const isRangeStart = (date: Date) => {
    if (!tempStart) return false;
    return isSameDay(date, tempStart);
  };

  const isRangeEnd = (date: Date) => {
    const end = tempEnd || (hoveredDate && !tempEnd ? hoveredDate : null);
    if (!end) return false;
    return isSameDay(date, end);
  };

  const days = generateCalendarDays();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 p-4 w-[320px]">
      {/* 月份導航 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-medium text-gray-800">
          {format(viewDate, 'yyyy年 M月', { locale: zhTW })}
        </span>
        <button
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* 星期標題 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* 日期網格 */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((day, index) => {
          const isCurrentMonth = isSameMonth(day, viewDate);
          const isToday = isSameDay(day, new Date());
          const isSelected = isRangeStart(day) || isRangeEnd(day);
          const inRange = isInRange(day);
          const isStart = isRangeStart(day);
          const isEnd = isRangeEnd(day);

          return (
            <div
              key={index}
              className={`relative ${inRange && !isSelected ? 'bg-[#fde8ec]' : ''} ${
                isStart && !isEnd ? 'rounded-l-full' : ''
              } ${isEnd && !isStart ? 'rounded-r-full' : ''} ${
                isStart && isEnd ? 'rounded-full' : ''
              }`}
            >
              <button
                onClick={() => handleDateClick(day)}
                onMouseEnter={() => !tempEnd && setHoveredDate(day)}
                onMouseLeave={() => setHoveredDate(null)}
                className={`
                  w-full aspect-square text-sm rounded-full transition-all flex items-center justify-center
                  ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                  ${isToday && !isSelected ? 'font-bold ring-1 ring-[#b20a2c]/30' : ''}
                  ${isSelected ? 'bg-[#b20a2c] text-white font-medium' : ''}
                  ${!isSelected && isCurrentMonth ? 'hover:bg-gray-100' : ''}
                  cursor-pointer
                `}
              >
                {format(day, 'd')}
              </button>
            </div>
          );
        })}
      </div>

      {/* 選擇提示 */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center mb-3">
          {!tempStart ? '選擇開始日期' : !tempEnd ? '選擇結束日期' : `${format(tempStart, 'MM/dd')} - ${format(tempEnd, 'MM/dd')}`}
        </p>

        {/* 快捷選項 */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              const end = new Date();
              const start = new Date();
              start.setDate(start.getDate() - 7);
              setTempStart(start);
              setTempEnd(end);
              onChange(start, end);
            }}
            className="flex-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            近7天
          </button>
          <button
            onClick={() => {
              const end = new Date();
              const start = new Date();
              start.setDate(start.getDate() - 30);
              setTempStart(start);
              setTempEnd(end);
              onChange(start, end);
            }}
            className="flex-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            近30天
          </button>
          <button
            onClick={() => {
              const end = new Date();
              const start = new Date();
              start.setDate(start.getDate() - 90);
              setTempStart(start);
              setTempEnd(end);
              onChange(start, end);
            }}
            className="flex-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            近90天
          </button>
        </div>
      </div>

      {/* 確認按鈕 */}
      <button
        onClick={onClose}
        className="w-full mt-3 px-4 py-2.5 bg-[#b20a2c] text-white rounded-xl text-sm font-medium hover:bg-[#8a0822] transition-colors"
      >
        確定
      </button>
    </div>
  );
}
