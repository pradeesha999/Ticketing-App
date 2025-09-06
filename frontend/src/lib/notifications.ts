import { writable } from 'svelte/store';

interface Notification {
	id: number;
	message: string;
	type: 'info' | 'success' | 'warning' | 'error';
	timestamp: Date;
}

export const notifications = writable<Notification[]>([]);

export function addNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration: number = 5000): number {
	const id = Date.now();
	const notification: Notification = {
		id,
		message,
		type,
		timestamp: new Date()
	};

	notifications.update(n => [...n, notification]);

	// Auto-remove notification after duration
	setTimeout(() => {
		removeNotification(id);
	}, duration);

	return id;
}

export function removeNotification(id: number): void {
	notifications.update(n => n.filter(notification => notification.id !== id));
}

export function clearAllNotifications(): void {
	notifications.set([]);
}

// Helper functions for different notification types
export function showSuccess(message: string, duration?: number): number {
	return addNotification(message, 'success', duration);
}

export function showError(message: string, duration?: number): number {
	return addNotification(message, 'error', duration);
}

export function showWarning(message: string, duration?: number): number {
	return addNotification(message, 'warning', duration);
}

export function showInfo(message: string, duration?: number): number {
	return addNotification(message, 'info', duration);
}
