import { useState, useEffect } from 'react';

export function useLocalStorageState<T>(key: string, defaultValue: T) {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const storedValue = window.localStorage.getItem(key);
            return storedValue ? JSON.parse(storedValue) as T : defaultValue;
        } catch (error) {
            console.error("Error reading localStorage key " + key + " from localStorage:", error);
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(storedValue));
        } catch (error) {
            console.error("Error setting localStorage key " + key + " to localStorage:", error);
        }
    }, [key, storedValue]);

    return [storedValue, setStoredValue] as const;
}

export default useLocalStorageState;