import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './i18n';
import './index.css'
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { resources } from '@wfrp/shared';

// If you want use Node.js, the`nodeIntegration` needs to be enabled in the Main process.
// import './demos/node'

console.log("Starting GM Tools App")

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

postMessage({ payload: 'removeLoading' }, '*')
