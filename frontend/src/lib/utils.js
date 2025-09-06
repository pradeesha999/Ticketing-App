// Utility functions for time calculations and formatting

export function calculateResolutionTime(createdAt, resolvedAt) {
  if (!createdAt || !resolvedAt) return null;
  
  const created = new Date(createdAt);
  const resolved = new Date(resolvedAt);
  const diffMs = resolved - created;
  
  if (diffMs <= 0) return null;
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  
  if (diffDays > 0) {
    return `${diffDays}d ${remainingHours}h ${diffMinutes}m`;
  } else if (remainingHours > 0) {
    return `${remainingHours}h ${diffMinutes}m`;
  } else {
    return `${diffMinutes}m`;
  }
}

export function formatDateTime(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatTime(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

