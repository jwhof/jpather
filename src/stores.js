import { writable, derived } from 'svelte/store';
import Path from './utils/Path.js';

// function to create a persistent store
const persistStore = (key, initialValue) => {
  const revivePaths = (value) => value.map(p => Path.revive(p));
  
  const storedValue = localStorage.getItem(key);
  let parsedValue;
  
  try {
    parsedValue = storedValue 
    ? key === 'paths'
      ? revivePaths(JSON.parse(storedValue))
      : JSON.parse(storedValue)
    : initialValue;
  } catch {
    parsedValue = initialValue;
  }
  
  const store = writable(parsedValue);
  store.subscribe(value => {
    localStorage.setItem(key, JSON.stringify(value));
  });
  return store;
  };

// creating persistent stores for various settings
export const paths = persistStore('paths', []);
export const robotLength = persistStore('robotLength', 18);
export const robotWidth = persistStore('robotWidth', 18);
export const robotUnits = persistStore('robotUnits', 'inches');
export const rotationUnits = persistStore('rotationUnits', 'degrees');
export const shouldShowHitbox = persistStore('shouldShowHitbox', false);
export const shouldHaveBoilerplate = persistStore('shouldHaveBoilerplate', false);
export const autoLinkPaths = persistStore('autoLinkPaths', true);
export const shouldRepeatPath = persistStore('shouldRepeatPath', true);

// derived store to calculate display dimensions
export const displayDimensions = derived(
  [robotLength, robotWidth, robotUnits],
  ([$length, $width, $units]) => ({
  displayLength: parseFloat(($units === 'inches' ? $length : $length * 2.54).toFixed(2)),
  displayWidth: parseFloat(($units === 'inches' ? $width : $width * 2.54).toFixed(2))
  })
);
