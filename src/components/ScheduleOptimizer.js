import React, { useState } from 'react';
import { formatTimeSlot, formatDuration, getPriorityInfo } from '../services/scheduleService.js';

export default function ScheduleOptimizer({ 
  recommendations, 
  onAcceptSlot, 
  onDismiss,
  isLoading = false 
}) {
  const [expandedTask, setExpandedTask] = useState(null);

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  const toggleExpanded = (index) => {
    setExpandedTask(expandedTask === index ? null : index);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-blue-500/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
          <span>🎯</span>
          <span>Schedule Optimization</span>
        </h3>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      <div className="text-sm text-gray-300 mb-4">
        Found optimal time slots for {recommendations.length} task{recommendations.length !== 1 ? 's' : ''}
      </div>

      <div className="space-y-3">
        {recommendations.map((rec, index) => {
          const task = rec.task;
          const topSlot = rec.suggestedSlots[0];
          const isExpanded = expandedTask === index;
          const priorityInfo = getPriorityInfo(task.priority);

          return (
            <div
              key={index}
              className="bg-gray-700/50 rounded-lg p-3 border border-gray-600"
            >
              {/* Task Header */}
              <div 
                className="flex items-start justify-between cursor-pointer"
                onClick={() => toggleExpanded(index)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{priorityInfo.emoji}</span>
                    <h4 className="font-medium text-white">{task.summary}</h4>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                    <span className={`px-2 py-0.5 rounded bg-${priorityInfo.color}-500/20 text-${priorityInfo.color}-300`}>
                      {priorityInfo.label} Priority
                    </span>
                    <span className="px-2 py-0.5 rounded bg-gray-600">
                      {formatDuration(task.duration)}
                    </span>
                    {task.location && (
                      <span className="px-2 py-0.5 rounded bg-gray-600">
                        📍 {task.location}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <button className="text-gray-400 hover:text-white ml-2">
                  {isExpanded ? '▼' : '▶'}
                </button>
              </div>

              {/* Best Time Slot */}
              {topSlot && (
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <div className="text-xs text-gray-400 mb-1">Best Time Slot:</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-blue-300">
                        {formatTimeSlot(topSlot)}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Score: {topSlot.score}/200
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcceptSlot(task, topSlot);
                      }}
                      disabled={isLoading}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
                    >
                      {isLoading ? 'Adding...' : 'Schedule'}
                    </button>
                  </div>

                  {/* Reasoning */}
                  {rec.reasoning && (
                    <div className="mt-2 text-xs text-gray-400 bg-gray-800/50 rounded p-2">
                      💡 {rec.reasoning}
                    </div>
                  )}

                  {/* Commute Info */}
                  {(topSlot.commuteTimeBefore > 0 || topSlot.commuteTimeAfter > 0) && (
                    <div className="mt-2 text-xs text-yellow-300 bg-yellow-500/10 rounded p-2">
                      🚗 Travel time: 
                      {topSlot.commuteTimeBefore > 0 && ` ${topSlot.commuteTimeBefore} min before`}
                      {topSlot.commuteTimeBefore > 0 && topSlot.commuteTimeAfter > 0 && ','}
                      {topSlot.commuteTimeAfter > 0 && ` ${topSlot.commuteTimeAfter} min after`}
                    </div>
                  )}
                </div>
              )}

              {/* Alternative Slots (when expanded) */}
              {isExpanded && rec.suggestedSlots.length > 1 && (
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <div className="text-xs text-gray-400 mb-2">Alternative Time Slots:</div>
                  <div className="space-y-2">
                    {rec.suggestedSlots.slice(1, 3).map((slot, slotIndex) => (
                      <div
                        key={slotIndex}
                        className="flex items-center justify-between bg-gray-800/50 rounded p-2"
                      >
                        <div className="flex-1">
                          <div className="text-xs text-gray-300">
                            {formatTimeSlot(slot)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Score: {slot.score}/200
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAcceptSlot(task, slot);
                          }}
                          disabled={isLoading}
                          className="px-2 py-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white text-xs rounded transition-colors"
                        >
                          Schedule
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Task Description (when expanded) */}
              {isExpanded && task.description && (
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <div className="text-xs text-gray-400">Description:</div>
                  <div className="text-sm text-gray-300 mt-1">{task.description}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}